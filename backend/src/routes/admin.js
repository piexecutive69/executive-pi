import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

function toInt(value, fallback = 0) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.trunc(next)
}

function toNullableString(value) {
  if (value === undefined || value === null) return null
  const next = String(value).trim()
  return next || null
}

function toBooleanInt(value, fallback = 0) {
  if (value === undefined || value === null) return fallback ? 1 : 0
  if (typeof value === 'boolean') return value ? 1 : 0
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return 1
  if (['0', 'false', 'no', 'off'].includes(normalized)) return 0
  return fallback ? 1 : 0
}

const ORDER_STATUSES = new Set(['pending', 'waiting_payment', 'paid', 'cancelled', 'completed'])
const USER_STATUSES = new Set(['active', 'inactive'])
const MARKUP_MODES = new Set(['fixed', 'percentage'])
const BONUS_RULE_TYPES = new Set(['transaction_bonus', 'upgrade_bonus'])
const BONUS_MODES = new Set(['fixed', 'percentage'])
const BONUS_CURRENCIES = new Set(['idr'])
const PRODUCT_IMAGE_PREFIX = '/assets/img/products/'

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function ensureUniqueSlug(mysql, baseSlug, currentId = null) {
  const fallbackSlug = `product-${Date.now()}`
  const root = slugify(baseSlug) || fallbackSlug
  let candidate = root
  let suffix = 1

  while (true) {
    const params = [candidate]
    let query = 'SELECT id FROM products WHERE slug = ? LIMIT 1'
    if (currentId) {
      query = 'SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1'
      params.push(currentId)
    }
    const [rows] = await mysql.query(query, params)
    if (!rows.length) return candidate
    suffix += 1
    candidate = `${root}-${suffix}`
  }
}

function resolveProductImageDir() {
  return path.resolve(process.cwd(), '../public/assets/img/products')
}

function canDeleteManagedProductImage(imageUrl) {
  return Boolean(imageUrl && String(imageUrl).startsWith(PRODUCT_IMAGE_PREFIX))
}

async function ensureSystemConfigsTable(mysql) {
  await mysql.query(
    `CREATE TABLE IF NOT EXISTS system_configs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(120) NOT NULL UNIQUE,
      config_value TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  )
}

async function getSystemConfigMap(mysql, keys = []) {
  if (!keys.length) return new Map()
  const placeholders = keys.map(() => '?').join(',')
  const [rows] = await mysql.query(
    `SELECT config_key, config_value
     FROM system_configs
     WHERE config_key IN (${placeholders})`,
    keys,
  )
  return new Map(rows.map((row) => [String(row.config_key), row.config_value]))
}

async function upsertSystemConfig(mysql, key, value) {
  await mysql.query(
    `INSERT INTO system_configs (config_key, config_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       config_value = VALUES(config_value),
       updated_at = NOW()`,
    [key, String(value)],
  )
}

export async function adminRoutes(app) {
  app.get(
    '/system-config',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin get system config (gateway + markups + bonus + upgrade)',
      },
    },
    async () => {
      await ensureSystemConfigsTable(app.mysql)
      const [levels] = await app.mysql.query(
        `SELECT id, code, display_name, sort_order, upgrade_fee_idr, upgrade_fee_pi, is_active
         FROM membership_levels
         ORDER BY sort_order ASC`,
      )

      const [gateways] = await app.mysql.query(
        `SELECT id, code, name, is_active
         FROM payment_gateways
         ORDER BY id ASC`,
      )

      const [markups] = await app.mysql.query(
        `SELECT id, level_id, product_type, product_code, markup_mode, markup_idr, min_markup_idr, is_active
         FROM product_markups
         WHERE product_code LIKE 'GLOBAL_PREPAID_%'
            OR product_code LIKE 'GLOBAL_POSTPAID_%'`,
      )
      const [bonusRules] = await app.mysql.query(
        `SELECT id, rule_type, for_level_id, depth, bonus_mode, bonus_value, bonus_currency, is_active
         FROM affiliate_bonus_rules
         WHERE bonus_currency = 'idr'
         ORDER BY for_level_id ASC, rule_type ASC, depth ASC, id ASC`,
      )
      const systemConfigKeys = [
        'physical_markup_mode',
        'physical_markup_value',
        'physical_min_markup_idr',
        'physical_markup_active',
      ]
      const configMap = await getSystemConfigMap(app.mysql, systemConfigKeys)

      const markupMap = new Map()
      for (const row of markups) {
        markupMap.set(`${row.level_id}:${row.product_type}`, row)
      }

      const levelConfigs = levels.map((level) => {
        const prepaid = markupMap.get(`${level.id}:prepaid`) || null
        const postpaid = markupMap.get(`${level.id}:postpaid`) || null
        return {
          level_id: level.id,
          code: level.code,
          display_name: level.display_name,
          sort_order: level.sort_order,
          level_is_active: Boolean(level.is_active),
          upgrade_fee_idr: Number(level.upgrade_fee_idr || 0),
          upgrade_fee_pi: Number(level.upgrade_fee_pi || 0),
          prepaid_markup: prepaid
            ? {
                id: prepaid.id,
                markup_mode: prepaid.markup_mode,
                markup_idr: Number(prepaid.markup_idr || 0),
                min_markup_idr: Number(prepaid.min_markup_idr || 0),
                is_active: Boolean(prepaid.is_active),
              }
            : null,
          postpaid_markup: postpaid
            ? {
                id: postpaid.id,
                markup_mode: postpaid.markup_mode,
                markup_idr: Number(postpaid.markup_idr || 0),
                min_markup_idr: Number(postpaid.min_markup_idr || 0),
                is_active: Boolean(postpaid.is_active),
              }
            : null,
        }
      })

      return {
        gateways: gateways.map((gateway) => ({
          id: gateway.id,
          code: gateway.code,
          name: gateway.name,
          is_active: Boolean(gateway.is_active),
        })),
        levels: levelConfigs,
        bonuses: bonusRules.map((row) => ({
          id: row.id,
          rule_type: row.rule_type,
          for_level_id: Number(row.for_level_id),
          depth: Number(row.depth),
          bonus_mode: row.bonus_mode,
          bonus_value: Number(row.bonus_value || 0),
          bonus_currency: 'idr',
          is_active: Boolean(row.is_active),
        })),
        physical_markup: {
          markup_mode: MARKUP_MODES.has(String(configMap.get('physical_markup_mode') || '').toLowerCase())
            ? String(configMap.get('physical_markup_mode')).toLowerCase()
            : 'fixed',
          markup_value: Number(configMap.get('physical_markup_value') || 0),
          min_markup_idr: Number(configMap.get('physical_min_markup_idr') || 0),
          is_active: toBooleanInt(configMap.get('physical_markup_active'), 1) === 1,
        },
      }
    },
  )

  app.patch(
    '/system-config',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin update system config (gateway + markups + bonus + upgrade)',
      },
    },
    async (request, reply) => {
      const body = request.body || {}
      const gateways = Array.isArray(body.gateways) ? body.gateways : []
      const markups = Array.isArray(body.markups) ? body.markups : []
      const levels = Array.isArray(body.levels) ? body.levels : []
      const bonuses = Array.isArray(body.bonuses) ? body.bonuses : []
      const physicalMarkup = body.physical_markup && typeof body.physical_markup === 'object' ? body.physical_markup : null

      if (!gateways.length && !markups.length && !levels.length && !bonuses.length && !physicalMarkup) {
        return reply.code(400).send({ message: 'No config payload provided' })
      }

      await ensureSystemConfigsTable(app.mysql)
      await app.mysql.query('START TRANSACTION')
      try {
        await app.mysql.query(
          `UPDATE affiliate_bonus_rules
           SET bonus_currency = 'idr'
           WHERE bonus_currency <> 'idr'`,
        )

        for (const item of gateways) {
          const code = String(item?.code || '').trim().toLowerCase()
          if (!['pi_sdk', 'duitku'].includes(code)) {
            throw new Error(`Invalid gateway code: ${code || '-'}`)
          }
          const isActive = toBooleanInt(item?.is_active, 0)
          await app.mysql.query(
            `UPDATE payment_gateways
             SET is_active = ?
             WHERE code = ?`,
            [isActive, code],
          )
        }

        for (const item of markups) {
          const levelId = toInt(item?.level_id)
          const productType = String(item?.product_type || '').trim().toLowerCase()
          const markupMode = String(item?.markup_mode || 'fixed').trim().toLowerCase()
          const markupIdr = Number(item?.markup_idr || 0)
          const minMarkupIdr = Number(item?.min_markup_idr || 0)
          const isActive = toBooleanInt(item?.is_active, 1)

          if (!levelId) throw new Error('Invalid level_id on markups payload')
          if (!['prepaid', 'postpaid'].includes(productType)) throw new Error(`Invalid product_type: ${productType || '-'}`)
          if (!MARKUP_MODES.has(markupMode)) throw new Error(`Invalid markup_mode: ${markupMode || '-'}`)
          if (!Number.isFinite(markupIdr) || markupIdr < 0) throw new Error('markup_idr must be >= 0')
          if (!Number.isFinite(minMarkupIdr) || minMarkupIdr < 0) throw new Error('min_markup_idr must be >= 0')

          const [levels] = await app.mysql.query('SELECT id, code FROM membership_levels WHERE id = ? LIMIT 1', [levelId])
          if (!levels.length) throw new Error(`membership level not found: ${levelId}`)
          const levelCode = String(levels[0].code || '').toLowerCase()
          const productCode = `GLOBAL_${productType.toUpperCase()}_${levelCode}`

          await app.mysql.query(
            `INSERT INTO product_markups
               (level_id, product_type, product_code, markup_mode, markup_idr, min_markup_idr, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               markup_mode = VALUES(markup_mode),
               markup_idr = VALUES(markup_idr),
               min_markup_idr = VALUES(min_markup_idr),
               is_active = VALUES(is_active),
               updated_at = NOW()`,
            [levelId, productType, productCode, markupMode, markupIdr, minMarkupIdr, isActive],
          )
        }

        for (const item of levels) {
          const levelId = toInt(item?.level_id)
          if (!levelId) throw new Error('Invalid level_id on levels payload')
          const upgradeFeeIdr = Number(item?.upgrade_fee_idr || 0)
          const upgradeFeePi = Number(item?.upgrade_fee_pi || 0)
          const isActive = toBooleanInt(item?.is_active, 1)
          if (!Number.isFinite(upgradeFeeIdr) || upgradeFeeIdr < 0) throw new Error('upgrade_fee_idr must be >= 0')
          if (!Number.isFinite(upgradeFeePi) || upgradeFeePi < 0) throw new Error('upgrade_fee_pi must be >= 0')

          await app.mysql.query(
            `UPDATE membership_levels
             SET upgrade_fee_idr = ?, upgrade_fee_pi = ?, is_active = ?
             WHERE id = ?`,
            [upgradeFeeIdr, upgradeFeePi, isActive, levelId],
          )
        }

        for (const item of bonuses) {
          const id = toInt(item?.id, 0)
          const ruleType = String(item?.rule_type || '').trim().toLowerCase()
          const levelId = toInt(item?.for_level_id || item?.level_id)
          const depth = toInt(item?.depth)
          const bonusMode = String(item?.bonus_mode || 'fixed').trim().toLowerCase()
          const bonusValue = Number(item?.bonus_value || 0)
          // Bonus distribution is IDR-only.
          const bonusCurrency = 'idr'
          const isActive = toBooleanInt(item?.is_active, 1)

          if (!BONUS_RULE_TYPES.has(ruleType)) throw new Error(`Invalid rule_type: ${ruleType || '-'}`)
          if (!levelId) throw new Error('Invalid for_level_id on bonuses payload')
          if (depth < 1 || depth > 3) throw new Error('bonus depth must be between 1 and 3')
          if (!BONUS_MODES.has(bonusMode)) throw new Error(`Invalid bonus_mode: ${bonusMode || '-'}`)
          if (!BONUS_CURRENCIES.has(bonusCurrency)) throw new Error(`Invalid bonus_currency: ${bonusCurrency || '-'}`)
          if (!Number.isFinite(bonusValue) || bonusValue < 0) throw new Error('bonus_value must be >= 0')

          const [levels] = await app.mysql.query('SELECT id FROM membership_levels WHERE id = ? LIMIT 1', [levelId])
          if (!levels.length) throw new Error(`membership level not found: ${levelId}`)

          if (id > 0) {
            await app.mysql.query(
              `UPDATE affiliate_bonus_rules
               SET rule_type = ?, for_level_id = ?, depth = ?, bonus_mode = ?, bonus_value = ?, bonus_currency = ?, is_active = ?
               WHERE id = ?`,
              [ruleType, levelId, depth, bonusMode, bonusValue, bonusCurrency, isActive, id],
            )
          } else {
            const [existing] = await app.mysql.query(
              `SELECT id
               FROM affiliate_bonus_rules
               WHERE rule_type = ? AND for_level_id = ? AND depth = ? AND bonus_currency = ?
               ORDER BY id ASC
               LIMIT 1`,
              [ruleType, levelId, depth, bonusCurrency],
            )
            if (existing.length) {
              await app.mysql.query(
                `UPDATE affiliate_bonus_rules
                 SET bonus_mode = ?, bonus_value = ?, is_active = ?
                 WHERE id = ?`,
                [bonusMode, bonusValue, isActive, existing[0].id],
              )
            } else {
              await app.mysql.query(
                `INSERT INTO affiliate_bonus_rules
                   (rule_type, for_level_id, depth, bonus_mode, bonus_value, bonus_currency, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [ruleType, levelId, depth, bonusMode, bonusValue, bonusCurrency, isActive],
              )
            }
          }
        }

        if (physicalMarkup) {
          const markupMode = String(physicalMarkup.markup_mode || 'fixed').trim().toLowerCase()
          const markupValue = Number(physicalMarkup.markup_value || 0)
          const minMarkupIdr = Number(physicalMarkup.min_markup_idr || 0)
          const isActive = toBooleanInt(physicalMarkup.is_active, 1)

          if (!MARKUP_MODES.has(markupMode)) throw new Error(`Invalid physical markup_mode: ${markupMode || '-'}`)
          if (!Number.isFinite(markupValue) || markupValue < 0) throw new Error('physical markup_value must be >= 0')
          if (!Number.isFinite(minMarkupIdr) || minMarkupIdr < 0) throw new Error('physical min_markup_idr must be >= 0')

          await upsertSystemConfig(app.mysql, 'physical_markup_mode', markupMode)
          await upsertSystemConfig(app.mysql, 'physical_markup_value', markupValue)
          await upsertSystemConfig(app.mysql, 'physical_min_markup_idr', minMarkupIdr)
          await upsertSystemConfig(app.mysql, 'physical_markup_active', isActive)
        }

        await app.mysql.query('COMMIT')
      } catch (error) {
        await app.mysql.query('ROLLBACK')
        return reply.code(400).send({ message: error.message || 'Failed to update system config' })
      }

      const [updatedGateways] = await app.mysql.query(
        `SELECT id, code, name, is_active
         FROM payment_gateways
         ORDER BY id ASC`,
      )
      return {
        ok: true,
        gateways: updatedGateways.map((gateway) => ({
          id: gateway.id,
          code: gateway.code,
          name: gateway.name,
          is_active: Boolean(gateway.is_active),
        })),
      }
    },
  )

  app.get(
    '/product-categories',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin list product categories',
      },
    },
    async () => {
      const [rows] = await app.mysql.query(
        `SELECT id, name, slug
         FROM product_categories
         ORDER BY name ASC`,
      )
      return rows
    },
  )

  app.post(
    '/products/upload-image',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Upload product image and optionally delete previous one',
      },
    },
    async (request, reply) => {
      const upload = await request.file()
      if (!upload) {
        return reply.code(400).send({ message: 'image file is required' })
      }

      const allowedMime = new Map([
        ['image/jpeg', '.jpg'],
        ['image/png', '.png'],
        ['image/webp', '.webp'],
      ])
      const ext = allowedMime.get(upload.mimetype)
      if (!ext) {
        upload.file.resume()
        return reply.code(400).send({ message: 'Unsupported image type. Use JPG, PNG, or WEBP.' })
      }

      const prevImageUrl = toNullableString(upload.fields?.previousImageUrl?.value)
      const uploadDir = resolveProductImageDir()
      await fs.mkdir(uploadDir, { recursive: true })

      const filename = `product-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
      const destination = path.join(uploadDir, filename)
      await pipeline(upload.file, createWriteStream(destination))

      const imageUrl = `${PRODUCT_IMAGE_PREFIX}${filename}`

      if (canDeleteManagedProductImage(prevImageUrl)) {
        const prevFilename = path.basename(String(prevImageUrl))
        if (prevFilename && prevFilename !== filename) {
          const prevPath = path.join(uploadDir, prevFilename)
          await fs.unlink(prevPath).catch(() => {})
        }
      }

      return {
        imageUrl,
      }
    },
  )

  app.get(
    '/summary',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin summary metrics',
      },
    },
    async () => {
      const [[productRows], [userRows], [orderRows], [gmvRows], [todayRows]] = await Promise.all([
        app.mysql.query('SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_total FROM products'),
        app.mysql.query('SELECT COUNT(*) AS total FROM users'),
        app.mysql.query('SELECT COUNT(*) AS total FROM orders'),
        app.mysql.query("SELECT COALESCE(SUM(total_idr), 0) AS paid_total_idr FROM orders WHERE status IN ('paid','completed')"),
        app.mysql.query(
          "SELECT COUNT(*) AS total FROM orders WHERE DATE(created_at) = CURRENT_DATE()",
        ),
      ])

      return {
        productsTotal: Number(productRows[0]?.total || 0),
        activeProductsTotal: Number(productRows[0]?.active_total || 0),
        usersTotal: Number(userRows[0]?.total || 0),
        ordersTotal: Number(orderRows[0]?.total || 0),
        ordersToday: Number(todayRows[0]?.total || 0),
        paidGmvIdr: Number(gmvRows[0]?.paid_total_idr || 0),
      }
    },
  )

  app.get(
    '/products',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin list products (include inactive)',
      },
    },
    async (request) => {
      const page = Math.max(toInt(request.query?.page, 1), 1)
      const limit = Math.min(Math.max(toInt(request.query?.limit, 20), 1), 100)
      const offset = (page - 1) * limit
      const search = toNullableString(request.query?.search)
      const status = String(request.query?.status || 'all').toLowerCase()

      const conditions = []
      const params = []

      if (status === 'active') {
        conditions.push('p.is_active = 1')
      } else if (status === 'inactive') {
        conditions.push('p.is_active = 0')
      }

      if (search) {
        conditions.push('(p.name LIKE ? OR p.slug LIKE ? OR p.description LIKE ?)')
        const keyword = `%${search}%`
        params.push(keyword, keyword, keyword)
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const [rows] = await app.mysql.query(
        `SELECT
           p.id, p.category_id, p.slug, p.name, p.description, p.price_idr, p.price_pi,
           p.stock, p.rating, p.image_url, p.is_active, p.created_at, p.updated_at,
           c.name AS category_name
         FROM products p
         JOIN product_categories c ON c.id = p.category_id
         ${whereClause}
         ORDER BY p.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )

      const [countRows] = await app.mysql.query(
        `SELECT COUNT(*) AS total
         FROM products p
         ${whereClause}`,
        params,
      )

      return {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        items: rows,
      }
    },
  )

  app.post(
    '/products',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin create product',
      },
    },
    async (request, reply) => {
      const body = request.body || {}
      const name = String(body.name || '').trim()
      const description = toNullableString(body.description)
      const categoryId = toInt(body.category_id)
      const stock = toInt(body.stock, -1)
      const priceIdr = Number(body.price_idr)
      const pricePi = Number(body.price_pi ?? 0)
      const rating = Number(body.rating ?? 0)
      const isActive = body.is_active === undefined ? 1 : body.is_active ? 1 : 0
      const imageUrl = toNullableString(body.image_url)

      if (!name) return reply.code(400).send({ message: 'name is required' })
      if (!categoryId) return reply.code(400).send({ message: 'category_id is required' })
      if (!Number.isFinite(priceIdr) || priceIdr < 0) return reply.code(400).send({ message: 'price_idr must be >= 0' })
      if (!Number.isFinite(pricePi) || pricePi < 0) return reply.code(400).send({ message: 'price_pi must be >= 0' })
      if (stock < 0) return reply.code(400).send({ message: 'stock must be >= 0' })
      if (!Number.isFinite(rating) || rating < 0) return reply.code(400).send({ message: 'rating must be >= 0' })

      const [categories] = await app.mysql.query('SELECT id FROM product_categories WHERE id = ? LIMIT 1', [categoryId])
      if (!categories.length) return reply.code(400).send({ message: 'category_id not found' })

      const slug = await ensureUniqueSlug(app.mysql, body.slug || name)
      const [result] = await app.mysql.query(
        `INSERT INTO products
           (category_id, slug, name, description, price_idr, price_pi, stock, rating, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [categoryId, slug, name, description, priceIdr, pricePi, stock, rating, imageUrl, isActive],
      )

      const [rows] = await app.mysql.query(
        `SELECT
           p.id, p.category_id, p.slug, p.name, p.description, p.price_idr, p.price_pi,
           p.stock, p.rating, p.image_url, p.is_active, p.created_at, p.updated_at,
           c.name AS category_name
         FROM products p
         JOIN product_categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [result.insertId],
      )

      return reply.code(201).send(rows[0])
    },
  )

  app.patch(
    '/products/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin update product fields',
      },
    },
    async (request, reply) => {
      const id = toInt(request.params?.id)
      if (!id) return reply.code(400).send({ message: 'Invalid product id' })

      const [rows] = await app.mysql.query('SELECT id, image_url FROM products WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return reply.code(404).send({ message: 'Product not found' })

      const body = request.body || {}
      const updates = []
      const params = []

      if (body.name !== undefined) {
        const name = String(body.name || '').trim()
        if (!name) return reply.code(400).send({ message: 'name cannot be empty' })
        updates.push('name = ?')
        params.push(name)
      }

      if (body.description !== undefined) {
        updates.push('description = ?')
        params.push(toNullableString(body.description))
      }

      if (body.price_idr !== undefined) {
        const value = Number(body.price_idr)
        if (!Number.isFinite(value) || value < 0) return reply.code(400).send({ message: 'price_idr must be >= 0' })
        updates.push('price_idr = ?')
        params.push(value)
      }

      if (body.price_pi !== undefined) {
        const value = Number(body.price_pi)
        if (!Number.isFinite(value) || value < 0) return reply.code(400).send({ message: 'price_pi must be >= 0' })
        updates.push('price_pi = ?')
        params.push(value)
      }

      if (body.stock !== undefined) {
        const value = toInt(body.stock, -1)
        if (value < 0) return reply.code(400).send({ message: 'stock must be >= 0' })
        updates.push('stock = ?')
        params.push(value)
      }

      if (body.is_active !== undefined) {
        updates.push('is_active = ?')
        params.push(body.is_active ? 1 : 0)
      }

      if (body.category_id !== undefined) {
        const categoryId = toInt(body.category_id)
        if (!categoryId) return reply.code(400).send({ message: 'Invalid category_id' })
        const [categories] = await app.mysql.query('SELECT id FROM product_categories WHERE id = ? LIMIT 1', [categoryId])
        if (!categories.length) return reply.code(400).send({ message: 'category_id not found' })
        updates.push('category_id = ?')
        params.push(categoryId)
      }

      if (body.image_url !== undefined) {
        updates.push('image_url = ?')
        params.push(toNullableString(body.image_url))
      }

      if (!updates.length) {
        return reply.code(400).send({ message: 'No updatable field provided' })
      }

      await app.mysql.query(
        `UPDATE products
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = ?`,
        [...params, id],
      )

      const currentImageUrl = toNullableString(rows[0]?.image_url)
      const nextImageUrl = body.image_url === undefined ? currentImageUrl : toNullableString(body.image_url)
      if (currentImageUrl && nextImageUrl && currentImageUrl !== nextImageUrl && canDeleteManagedProductImage(currentImageUrl)) {
        const filename = path.basename(currentImageUrl)
        const fullPath = path.join(resolveProductImageDir(), filename)
        await fs.unlink(fullPath).catch(() => {})
      }

      const [resultRows] = await app.mysql.query(
        `SELECT
           p.id, p.category_id, p.slug, p.name, p.description, p.price_idr, p.price_pi,
           p.stock, p.rating, p.image_url, p.is_active, p.created_at, p.updated_at,
           c.name AS category_name
         FROM products p
         JOIN product_categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [id],
      )

      return resultRows[0]
    },
  )

  app.get(
    '/orders',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin list all orders',
      },
    },
    async (request) => {
      const page = Math.max(toInt(request.query?.page, 1), 1)
      const limit = Math.min(Math.max(toInt(request.query?.limit, 20), 1), 100)
      const offset = (page - 1) * limit
      const search = toNullableString(request.query?.search)
      const status = toNullableString(request.query?.status)

      const conditions = []
      const params = []

      if (status && ORDER_STATUSES.has(status)) {
        conditions.push('o.status = ?')
        params.push(status)
      }

      if (search) {
        const keyword = `%${search}%`
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR o.id LIKE ?)')
        params.push(keyword, keyword, keyword, keyword)
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const [rows] = await app.mysql.query(
        `SELECT
           o.id, o.user_id, o.status, o.subtotal_idr, o.shipping_idr, o.total_idr,
           o.payment_method, o.pi_payment_identifier, o.pi_txid, o.shipping_address, o.created_at, o.updated_at,
           u.name AS user_name, u.email AS user_email, u.phone AS user_phone
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${whereClause}
         ORDER BY o.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )

      const [countRows] = await app.mysql.query(
        `SELECT COUNT(*) AS total
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${whereClause}`,
        params,
      )

      return {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        items: rows,
      }
    },
  )

  app.get(
    '/orders/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin order detail with items',
      },
    },
    async (request, reply) => {
      const id = toInt(request.params?.id)
      if (!id) return reply.code(400).send({ message: 'Invalid order id' })

      const [rows] = await app.mysql.query(
        `SELECT
           o.id, o.user_id, o.status, o.subtotal_idr, o.shipping_idr, o.total_idr,
           o.payment_method, o.pi_payment_identifier, o.pi_txid, o.shipping_address, o.created_at, o.updated_at,
           u.name AS user_name, u.email AS user_email, u.phone AS user_phone
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows.length) return reply.code(404).send({ message: 'Order not found' })

      const [items] = await app.mysql.query(
        `SELECT id, product_id, product_name, qty, unit_price_idr, line_total_idr
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`,
        [id],
      )

      return {
        ...rows[0],
        items,
      }
    },
  )

  app.patch(
    '/orders/:id/status',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin update order status',
      },
    },
    async (request, reply) => {
      const id = toInt(request.params?.id)
      const status = String(request.body?.status || '').trim()
      if (!id) return reply.code(400).send({ message: 'Invalid order id' })
      if (!ORDER_STATUSES.has(status)) {
        return reply.code(400).send({ message: 'Invalid status value' })
      }

      const [rows] = await app.mysql.query(
        'SELECT id, payment_method, status FROM orders WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows.length) return reply.code(404).send({ message: 'Order not found' })
      const order = rows[0]
      if (String(order.payment_method || '').toLowerCase() === 'pi_sdk' && String(order.status) !== status) {
        return reply.code(400).send({
          message: 'Status transaksi Pi SDK tidak bisa diubah manual dari admin panel',
        })
      }

      await app.mysql.query(
        `UPDATE orders
         SET status = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, id],
      )

      const [updatedRows] = await app.mysql.query(
        `SELECT id, user_id, status, subtotal_idr, shipping_idr, total_idr, payment_method, pi_payment_identifier, pi_txid, shipping_address, created_at, updated_at
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [id],
      )

      return updatedRows[0]
    },
  )

  app.get(
    '/pi-wallets',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin list: Pi wallet linked users',
      },
    },
    async (request) => {
      const page = Math.max(toInt(request.query?.page, 1), 1)
      const limit = Math.min(Math.max(toInt(request.query?.limit, 20), 1), 100)
      const offset = (page - 1) * limit
      const status = String(request.query?.status || 'all').toLowerCase()
      const searchInput = toNullableString(request.query?.search)
      const search = searchInput ? `%${searchInput}%` : null

      const conditions = []
      const params = []

      if (status === 'linked') {
        conditions.push('upw.user_id IS NOT NULL')
      } else if (status === 'unlinked') {
        conditions.push('upw.user_id IS NULL')
      }

      if (search) {
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR upw.pi_uid LIKE ? OR upw.wallet_address LIKE ?)')
        params.push(search, search, search, search, search)
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const [countRows] = await app.mysql.query(
        `SELECT COUNT(*) AS total
         FROM users u
         LEFT JOIN user_pi_wallets upw ON upw.user_id = u.id
         ${whereClause}`,
        params,
      )

      const [rows] = await app.mysql.query(
        `SELECT
           u.id, u.name, u.email, u.phone, u.status, u.idr_balance, u.pi_balance,
           upw.pi_uid AS pi_uid, upw.pi_username AS pi_username,
           upw.wallet_address AS wallet_address, upw.last_pi_balance AS last_pi_balance,
           upw.last_synced_at AS last_synced_at
         FROM users u
         LEFT JOIN user_pi_wallets upw ON upw.user_id = u.id
         ${whereClause}
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )

      return {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        items: rows.map((item) => ({
          ...item,
          is_linked: Boolean(item.pi_uid),
        })),
      }
    },
  )

  app.get(
    '/users',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin list users',
      },
    },
    async (request) => {
      const page = Math.max(toInt(request.query?.page, 1), 1)
      const limit = Math.min(Math.max(toInt(request.query?.limit, 20), 1), 100)
      const offset = (page - 1) * limit
      const search = toNullableString(request.query?.search)
      const status = toNullableString(request.query?.status)

      const conditions = []
      const params = []

      if (status && status !== 'all') {
        conditions.push('u.status = ?')
        params.push(status)
      }

      if (search) {
        const keyword = `%${search}%`
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)')
        params.push(keyword, keyword, keyword)
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const [rows] = await app.mysql.query(
        `SELECT
           u.id, u.name, u.email, u.phone, u.profile_image_url, u.idr_balance, u.pi_balance, u.status, u.created_at, u.updated_at,
           upw.pi_uid, upw.wallet_address, upw.last_pi_balance, upw.last_synced_at,
           ml.code AS membership_code, ml.display_name AS membership_name
         FROM users u
         LEFT JOIN user_pi_wallets upw ON upw.user_id = u.id
         LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
         LEFT JOIN membership_levels ml ON ml.id = um.level_id
         ${whereClause}
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )

      const [countRows] = await app.mysql.query(
        `SELECT COUNT(*) AS total
         FROM users u
         ${whereClause}`,
        params,
      )

      return {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        items: rows,
      }
    },
  )

  app.get(
    '/users/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin user detail',
      },
    },
    async (request, reply) => {
      const id = toInt(request.params?.id)
      if (!id) return reply.code(400).send({ message: 'Invalid user id' })

      const [rows] = await app.mysql.query(
        `SELECT
           u.id, u.name, u.email, u.phone, u.profile_image_url, u.idr_balance, u.pi_balance, u.status, u.created_at, u.updated_at,
           upw.pi_uid, upw.pi_username, upw.wallet_address, upw.wallet_secret_id, upw.last_pi_balance, upw.last_synced_at,
           ml.code AS membership_code, ml.display_name AS membership_name, um.started_at AS membership_started_at, um.expires_at AS membership_expires_at
         FROM users u
         LEFT JOIN user_pi_wallets upw ON upw.user_id = u.id
         LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
         LEFT JOIN membership_levels ml ON ml.id = um.level_id
         WHERE u.id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows.length) return reply.code(404).send({ message: 'User not found' })

      const [addresses] = await app.mysql.query(
        `SELECT
           ua.address_line, ua.postal_code,
           p.name AS province_name, r.name AS regency_name, d.name AS district_name, v.name AS village_name
         FROM user_addresses ua
         LEFT JOIN indonesia_provinces p ON p.id = ua.province_id
         LEFT JOIN indonesia_regencies r ON r.id = ua.regency_id
         LEFT JOIN indonesia_districts d ON d.id = ua.district_id
         LEFT JOIN indonesia_villages v ON v.id = ua.village_id
         WHERE ua.user_id = ?
         LIMIT 1`,
        [id],
      )

      const [orderSummary] = await app.mysql.query(
        `SELECT
           COUNT(*) AS total_orders,
           COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN total_idr ELSE 0 END), 0) AS paid_total_idr
         FROM orders
         WHERE user_id = ?`,
        [id],
      )

      const [recentOrders] = await app.mysql.query(
        `SELECT id, status, total_idr, payment_method, created_at
         FROM orders
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 5`,
        [id],
      )

      return {
        ...rows[0],
        address: addresses[0] || null,
        order_summary: {
          total_orders: Number(orderSummary[0]?.total_orders || 0),
          paid_total_idr: Number(orderSummary[0]?.paid_total_idr || 0),
        },
        recent_orders: recentOrders,
      }
    },
  )

  app.patch(
    '/users/:id/status',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Admin update user status',
      },
    },
    async (request, reply) => {
      const id = toInt(request.params?.id)
      const status = String(request.body?.status || '').trim().toLowerCase()
      if (!id) return reply.code(400).send({ message: 'Invalid user id' })
      if (!USER_STATUSES.has(status)) {
        return reply.code(400).send({ message: 'Invalid user status' })
      }

      const [rows] = await app.mysql.query('SELECT id FROM users WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return reply.code(404).send({ message: 'User not found' })

      await app.mysql.query(
        `UPDATE users
         SET status = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, id],
      )

      const [updatedRows] = await app.mysql.query(
        `SELECT id, name, email, phone, status, idr_balance, pi_balance, created_at, updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      return updatedRows[0]
    },
  )
}
