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

const ORDER_STATUSES = new Set(['pending', 'waiting_payment', 'paid', 'cancelled', 'completed'])
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

export async function adminRoutes(app) {
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
           o.payment_method, o.shipping_address, o.created_at, o.updated_at,
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
           o.payment_method, o.shipping_address, o.created_at, o.updated_at,
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

      const [rows] = await app.mysql.query('SELECT id FROM orders WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return reply.code(404).send({ message: 'Order not found' })

      await app.mysql.query(
        `UPDATE orders
         SET status = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, id],
      )

      const [updatedRows] = await app.mysql.query(
        `SELECT id, user_id, status, subtotal_idr, shipping_idr, total_idr, payment_method, shipping_address, created_at, updated_at
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
}
