import {
  fetchDigiflazzPriceList,
  upsertPostpaidProducts,
  upsertPrepaidProducts,
} from '../integrations/digiflazz.js'

function normalizeSyncCmd(cmd) {
  const v = String(cmd || '').toLowerCase()
  if (['all', 'both', '*'].includes(v)) return 'all'
  if (['prepaid', 'prabayar'].includes(v)) return 'prepaid'
  if (['pascabayar', 'pasca', 'postpaid'].includes(v)) return 'pasca'
  return null
}

function syncTypeByCmd(cmd) {
  if (cmd === 'prepaid') return 'prepaid_products'
  if (cmd === 'pasca') return 'postpaid_products'
  return 'price_update'
}

async function resolveMembership(mysql, userId) {
  if (userId) {
    const [rows] = await mysql.query(
      `SELECT ml.id AS level_id, ml.code
       FROM user_memberships um
       JOIN membership_levels ml ON ml.id = um.level_id
       WHERE um.user_id = ? AND um.status = 'active'
       ORDER BY um.updated_at DESC
       LIMIT 1`,
      [userId],
    )
    if (rows.length) return rows[0]
  }

  const [defaults] = await mysql.query(
    `SELECT id AS level_id, code
     FROM membership_levels
     WHERE is_default = 1 AND is_active = 1
     ORDER BY sort_order ASC
     LIMIT 1`,
  )
  return defaults[0] || null
}

async function getMarkupRules(mysql, { levelId, productType }) {
  if (!levelId || !['prepaid', 'postpaid'].includes(productType)) return []
  const [rows] = await mysql.query(
    `SELECT product_code, markup_mode, markup_idr, min_markup_idr
     FROM product_markups
     WHERE level_id = ? AND product_type = ? AND is_active = 1`,
    [levelId, productType],
  )
  return rows
}

function computeMarkup(baseAmountIdr, rule) {
  if (!rule) return 0
  const mode = String(rule.markup_mode || 'fixed').toLowerCase()
  const value = Number(rule.markup_idr || 0)
  const minMarkup = Number(rule.min_markup_idr || 0)
  const calc = mode === 'percentage' ? Math.round((baseAmountIdr * value) / 100) : value
  return Math.max(calc, minMarkup)
}

function attachDisplayPrice({ items, rules, membershipCode, productType, baseField, codeField }) {
  const globalCode = membershipCode ? `GLOBAL_${String(productType).toUpperCase()}_${String(membershipCode).toLowerCase()}` : null
  const ruleMap = new Map(rules.map((r) => [String(r.product_code || ''), r]))
  const globalRule = globalCode ? ruleMap.get(globalCode) : null

  return items.map((item) => {
    const basePrice = Number(item[baseField] || 0)
    const code = String(item[codeField] || '')
    const selectedRule = ruleMap.get(code) || globalRule || null
    const markup = computeMarkup(basePrice, selectedRule)
    return {
      ...item,
      applied_markup_idr: markup,
      final_price_idr: basePrice + markup,
    }
  })
}

async function appendSyncLog(app, { cmd, status, totalRecords = 0, notes = '', requestPayload = {}, responsePayload = {} }) {
  await app.mysql.query(
    `INSERT INTO digiflazz_sync_logs
     (sync_type, status, request_payload, response_payload, total_records, notes, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      syncTypeByCmd(cmd),
      status,
      JSON.stringify(requestPayload),
      JSON.stringify(responsePayload),
      totalRecords,
      String(notes || '').slice(0, 255),
    ],
  )
}

async function syncDigiflazzByCmd(app, { cmd, dryRun }) {
  const username = process.env.DIGIFLAZZ_USERNAME || ''
  const apiKey = process.env.DIGIFLAZZ_API_KEY || ''
  if (!username || !apiKey) {
    throw new Error('DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY must be set in .env')
  }

  const summary = {
    cmd,
    dryRun,
    prepaid: null,
    postpaid: null,
  }

  if (cmd === 'all' || cmd === 'prepaid') {
    const prepaid = await fetchDigiflazzPriceList({ cmd: 'prepaid', username, apiKey })
    const affected = dryRun ? 0 : await upsertPrepaidProducts(app.mysql, prepaid.data)
    summary.prepaid = {
      received: prepaid.data.length,
      affectedRows: affected,
    }
  }

  if (cmd === 'all' || cmd === 'pasca') {
    const postpaid = await fetchDigiflazzPriceList({ cmd: 'pascabayar', username, apiKey })
    const affected = dryRun ? 0 : await upsertPostpaidProducts(app.mysql, postpaid.data)
    summary.postpaid = {
      received: postpaid.data.length,
      affectedRows: affected,
    }
  }

  return summary
}

export async function digiflazzRoutes(app) {
  app.get(
    '/facets',
    {
      schema: {
        tags: ['Digiflazz'],
        summary: 'Get grouping data (prepaid by category, postpaid by brand)',
      },
    },
    async () => {
      const [prepaidCategories] = await app.mysql.query(
        `SELECT category AS facet, COUNT(*) AS total, MIN(price_base_idr) AS min_price
         FROM digiflazz_prepaid_products
         WHERE buyer_product_status = 1
           AND seller_product_status = 1
           AND category IS NOT NULL
           AND TRIM(category) <> ''
           AND UPPER(category) <> 'PASCABAYAR'
         GROUP BY category
         ORDER BY category ASC`,
      )

      const [postpaidBrands] = await app.mysql.query(
        `SELECT brand AS facet, COUNT(*) AS total, MIN(admin_base_idr) AS min_price
         FROM digiflazz_postpaid_products
         WHERE buyer_product_status = 1 AND seller_product_status = 1
         GROUP BY brand
         ORDER BY brand ASC`,
      )

      return {
        prepaid: prepaidCategories,
        pascabayar: postpaidBrands,
      }
    },
  )

  app.get(
    '/products',
    {
      schema: {
        tags: ['Digiflazz'],
        summary: 'List local Digiflazz products from synced tables',
      },
    },
    async (request, reply) => {
      const type = normalizeSyncCmd(request.query?.type || 'prepaid')
      const userId = Number(request.query?.userId || 0)
      const page = Math.max(Number(request.query?.page || 1), 1)
      const limit = Math.min(Math.max(Number(request.query?.limit || 20), 1), 100)
      const offset = (page - 1) * limit
      const search = request.query?.search ? `%${request.query.search}%` : null
      const brand = request.query?.brand ? String(request.query.brand) : null
      const category = request.query?.category ? String(request.query.category) : null

      if (!type || type === 'all') {
        return reply.code(400).send({ message: 'type must be prepaid or pascabayar' })
      }

      if (type === 'prepaid') {
        const conditions = [
          'buyer_product_status = 1',
          'seller_product_status = 1',
          "category IS NOT NULL",
          "TRIM(category) <> ''",
          "UPPER(category) <> 'PASCABAYAR'",
        ]
        const params = []
        if (search) {
          conditions.push('(product_name LIKE ? OR buyer_sku_code LIKE ?)')
          params.push(search, search)
        }
        if (brand) {
          conditions.push('brand = ?')
          params.push(brand)
        }
        if (category) {
          conditions.push('category = ?')
          params.push(category)
        }
        const whereClause = `WHERE ${conditions.join(' AND ')}`
        const [itemsRaw] = await app.mysql.query(
          `SELECT id, buyer_sku_code, product_name, category, brand, type, seller_name, price_base_idr, stock, unlimited_stock, desc_text
           FROM digiflazz_prepaid_products
           ${whereClause}
           ORDER BY brand ASC, price_base_idr ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        )
        const membership = await resolveMembership(app.mysql, userId)
        const rules = await getMarkupRules(app.mysql, {
          levelId: membership?.level_id || null,
          productType: 'prepaid',
        })
        const items = attachDisplayPrice({
          items: itemsRaw,
          rules,
          membershipCode: membership?.code || null,
          productType: 'prepaid',
          baseField: 'price_base_idr',
          codeField: 'buyer_sku_code',
        })
        const [countRows] = await app.mysql.query(
          `SELECT COUNT(*) AS total FROM digiflazz_prepaid_products ${whereClause}`,
          params,
        )
        return { type: 'prepaid', page, limit, total: countRows[0].total, items }
      }

      const conditions = ['buyer_product_status = 1', 'seller_product_status = 1']
      const params = []
      if (search) {
        conditions.push('(product_name LIKE ? OR buyer_sku_code LIKE ?)')
        params.push(search, search)
      }
      if (brand) {
        conditions.push('brand = ?')
        params.push(brand)
      }
      const whereClause = `WHERE ${conditions.join(' AND ')}`
      const [itemsRaw] = await app.mysql.query(
        `SELECT id, buyer_sku_code, product_name, category, brand, seller_name, admin_base_idr, commission_base_idr, desc_text
         FROM digiflazz_postpaid_products
         ${whereClause}
         ORDER BY brand ASC, admin_base_idr ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      const membership = await resolveMembership(app.mysql, userId)
      const rules = await getMarkupRules(app.mysql, {
        levelId: membership?.level_id || null,
        productType: 'postpaid',
      })
      const items = attachDisplayPrice({
        items: itemsRaw,
        rules,
        membershipCode: membership?.code || null,
        productType: 'postpaid',
        baseField: 'admin_base_idr',
        codeField: 'buyer_sku_code',
      })
      const [countRows] = await app.mysql.query(
        `SELECT COUNT(*) AS total FROM digiflazz_postpaid_products ${whereClause}`,
        params,
      )
      return { type: 'pascabayar', page, limit, total: countRows[0].total, items }
    },
  )

  app.get(
    '/sync/logs',
    {
      schema: {
        tags: ['Digiflazz'],
        summary: 'Get recent digiflazz sync logs',
      },
    },
    async (request) => {
      const limit = Math.min(Math.max(Number(request.query?.limit || 20), 1), 100)
      const [rows] = await app.mysql.query(
        `SELECT id, sync_type, status, total_records, notes, started_at, finished_at
         FROM digiflazz_sync_logs
         ORDER BY id DESC
         LIMIT ?`,
        [limit],
      )
      return rows
    },
  )

  app.post(
    '/sync/auto-missing',
    {
      schema: {
        tags: ['Digiflazz'],
        summary: 'Auto sync only missing table(s)',
      },
    },
    async () => {
      const [prepaidRows] = await app.mysql.query('SELECT COUNT(*) AS total FROM digiflazz_prepaid_products')
      const [postpaidRows] = await app.mysql.query('SELECT COUNT(*) AS total FROM digiflazz_postpaid_products')

      const missing = []
      if (Number(prepaidRows[0].total || 0) === 0) missing.push('prepaid')
      if (Number(postpaidRows[0].total || 0) === 0) missing.push('pasca')

      if (!missing.length) {
        return { ok: true, message: 'No missing sync target', missing, results: [] }
      }

      const results = []
      for (const cmd of missing) {
        try {
          const summary = await syncDigiflazzByCmd(app, { cmd, dryRun: false })
          const totalRecords = Number(summary.prepaid?.received || 0) + Number(summary.postpaid?.received || 0)
          await appendSyncLog(app, {
            cmd,
            status: 'success',
            totalRecords,
            notes: 'Auto missing sync success',
            requestPayload: { cmd, source: 'auto-missing' },
            responsePayload: summary,
          })
          results.push({ cmd, ok: true, summary })
        } catch (error) {
          await appendSyncLog(app, {
            cmd,
            status: 'failed',
            totalRecords: 0,
            notes: error.message || 'Auto missing sync failed',
            requestPayload: { cmd, source: 'auto-missing' },
            responsePayload: { error: error.message || 'unknown' },
          })
          results.push({ cmd, ok: false, error: error.message || 'Sync failed' })
        }
      }

      return { ok: results.every((r) => r.ok), missing, results }
    },
  )

  app.post(
    '/sync/price-list',
    {
      schema: {
        tags: ['Digiflazz'],
        summary: 'Sync Digiflazz price list to local DB',
      },
    },
    async (request, reply) => {
      const cmd = normalizeSyncCmd(request.body?.cmd || 'all')
      const dryRun = Boolean(request.body?.dryRun)
      if (!cmd) {
        return reply.code(400).send({ message: 'Invalid cmd. Use: prepaid, pasca, all' })
      }

      try {
        const summary = await syncDigiflazzByCmd(app, { cmd, dryRun })
        const totalRecords = Number(summary.prepaid?.received || 0) + Number(summary.postpaid?.received || 0)
        await appendSyncLog(app, {
          cmd,
          status: 'success',
          totalRecords,
          notes: 'Manual sync success',
          requestPayload: request.body || {},
          responsePayload: summary,
        })
        return summary
      } catch (error) {
        await appendSyncLog(app, {
          cmd,
          status: 'failed',
          totalRecords: 0,
          notes: error.message || 'Manual sync failed',
          requestPayload: request.body || {},
          responsePayload: { error: error.message || 'unknown' },
        })
        return reply.code(429).send({
          message: error.message || 'Digiflazz sync failed',
        })
      }
    },
  )
}
