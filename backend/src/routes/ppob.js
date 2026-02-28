function toInt(value) {
  return Number(value || 0)
}

async function getUserMembership(mysql, userId) {
  const [rows] = await mysql.query(
    `SELECT ml.id AS level_id, ml.code, ml.display_name
     FROM user_memberships um
     JOIN membership_levels ml ON ml.id = um.level_id
     WHERE um.user_id = ? AND um.status = 'active'
     ORDER BY um.updated_at DESC
     LIMIT 1`,
    [userId],
  )
  if (rows.length) return rows[0]

  const [defaults] = await mysql.query(
    `SELECT id AS level_id, code, display_name
     FROM membership_levels
     WHERE is_default = 1 AND is_active = 1
     ORDER BY sort_order ASC
     LIMIT 1`,
  )
  if (defaults.length) return defaults[0]

  return null
}

async function getMarkupRule(mysql, { levelId, membershipCode, productType, productCode }) {
  if (!levelId || !['prepaid', 'postpaid'].includes(productType)) return null
  const globalCode = membershipCode ? `GLOBAL_${String(productType).toUpperCase()}_${String(membershipCode).toLowerCase()}` : null

  const [rows] = await mysql.query(
    `SELECT markup_mode, markup_idr, min_markup_idr, product_code
     FROM product_markups
     WHERE level_id = ?
       AND product_type = ?
       AND is_active = 1
       AND (product_code = ? OR product_code = ?)
     ORDER BY (product_code = ?) DESC
     LIMIT 1`,
    [levelId, productType, productCode || '', globalCode || '', productCode || ''],
  )

  if (rows.length) return rows[0]

  const [fallback] = await mysql.query(
    `SELECT markup_mode, markup_idr, min_markup_idr, product_code
     FROM product_markups
     WHERE level_id = ?
       AND product_type = ?
       AND is_active = 1
       AND product_code LIKE ?
     ORDER BY id ASC
     LIMIT 1`,
    [levelId, productType, `GLOBAL_${String(productType).toUpperCase()}_%`],
  )
  return fallback[0] || null
}

function computeMarkupIdr({ amountIdr, markupRule }) {
  if (!markupRule) return 0
  const mode = String(markupRule.markup_mode || 'fixed').toLowerCase()
  const value = Number(markupRule.markup_idr || 0)
  const minMarkup = Number(markupRule.min_markup_idr || 0)
  let markup = 0

  if (mode === 'percentage') {
    markup = Math.round((amountIdr * value) / 100)
  } else {
    markup = value
  }
  return Math.max(markup, minMarkup)
}

async function computePpobPricing(mysql, { userId, serviceId, baseAmountIdr, amountPi, productType, productCode }) {
  const [serviceRows] = await mysql.query(
    'SELECT id, admin_fee_idr, admin_fee_pi FROM ppob_services WHERE id = ? AND is_active = 1',
    [serviceId],
  )
  if (!serviceRows.length) {
    return null
  }

  const membership = userId ? await getUserMembership(mysql, userId) : await getUserMembership(mysql, 0)
  const markupRule = await getMarkupRule(mysql, {
    levelId: membership?.level_id || null,
    membershipCode: membership?.code || null,
    productType,
    productCode,
  })

  const markupIdr = computeMarkupIdr({ amountIdr: baseAmountIdr, markupRule })
  const amountIdr = baseAmountIdr + markupIdr
  const isPrepaid = String(productType || '').toLowerCase() === 'prepaid'
  const adminFeeIdr = isPrepaid ? 0 : Number(serviceRows[0].admin_fee_idr)
  const adminFeePi = isPrepaid ? 0 : Number(serviceRows[0].admin_fee_pi)
  const totalIdr = amountIdr + adminFeeIdr
  const totalPi = amountPi + adminFeePi

  return {
    membership: {
      levelId: membership?.level_id || null,
      code: membership?.code || null,
      name: membership?.display_name || null,
    },
    pricing: {
      productType,
      productCode,
      baseAmountIdr,
      markupIdr,
      amountIdr,
      adminFeeIdr,
      totalIdr,
    },
    amountPi,
    adminFeePi,
    totalPi,
  }
}

export async function ppobRoutes(app) {
  app.get(
    '/services',
    {
      schema: {
        tags: ['PPOB'],
        summary: 'List active PPOB services',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                code: { type: 'string' },
                name: { type: 'string' },
                admin_fee_idr: { type: 'number' },
                admin_fee_pi: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async () => {
    const [rows] = await app.mysql.query(
      `SELECT id, code, name, admin_fee_idr, admin_fee_pi
       FROM ppob_services
       WHERE is_active = 1
       ORDER BY id ASC`,
    )
    return rows
    },
  )

  app.post(
    '/pricing-preview',
    {
      schema: {
        tags: ['PPOB'],
        summary: 'Preview PPOB pricing (base + markup + admin + total)',
        body: {
          type: 'object',
          required: ['serviceId', 'amountIdr'],
          properties: {
            userId: { type: 'integer' },
            serviceId: { type: 'integer' },
            amountIdr: { type: 'integer' },
            amountPi: { type: 'number' },
            productType: { type: 'string', enum: ['prepaid', 'postpaid', 'general'] },
            productCode: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = toInt(request.body?.userId || 0)
      const serviceId = toInt(request.body?.serviceId)
      const baseAmountIdr = toInt(request.body?.amountIdr)
      const amountPi = Number(request.body?.amountPi || 0)
      const productType = ['prepaid', 'postpaid', 'general'].includes(String(request.body?.productType || '').toLowerCase())
        ? String(request.body?.productType || '').toLowerCase()
        : 'general'
      const productCode = request.body?.productCode ? String(request.body.productCode) : null

      if (!serviceId || !baseAmountIdr) {
        return reply.code(400).send({ message: 'serviceId and amountIdr are required' })
      }

      const pricing = await computePpobPricing(app.mysql, {
        userId,
        serviceId,
        baseAmountIdr,
        amountPi,
        productType,
        productCode,
      })
      if (!pricing) {
        return reply.code(404).send({ message: 'PPOB service not found' })
      }

      return pricing
    },
  )

  app.post(
    '/transactions',
    {
      schema: {
        tags: ['PPOB'],
        summary: 'Create PPOB transaction',
        body: {
          type: 'object',
          required: ['userId', 'serviceId', 'customerRef', 'amountIdr'],
          properties: {
            userId: { type: 'integer' },
            serviceId: { type: 'integer' },
            customerRef: { type: 'string' },
            amountIdr: { type: 'integer' },
            amountPi: { type: 'number' },
            productType: { type: 'string', enum: ['prepaid', 'postpaid', 'general'] },
            productCode: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              userId: { type: 'integer' },
              serviceId: { type: 'integer' },
              membership: {
                type: 'object',
                properties: {
                  levelId: { type: ['integer', 'null'] },
                  code: { type: ['string', 'null'] },
                  name: { type: ['string', 'null'] },
                },
              },
              pricing: {
                type: 'object',
                properties: {
                  productType: { type: 'string' },
                  productCode: { type: ['string', 'null'] },
                  baseAmountIdr: { type: 'number' },
                  markupIdr: { type: 'number' },
                  amountIdr: { type: 'number' },
                  adminFeeIdr: { type: 'number' },
                  totalIdr: { type: 'number' },
                },
              },
              customerRef: { type: 'string' },
              amountIdr: { type: 'number' },
              amountPi: { type: 'number' },
              adminFeeIdr: { type: 'number' },
              adminFeePi: { type: 'number' },
              totalIdr: { type: 'number' },
              totalPi: { type: 'number' },
              status: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
    const userId = toInt(request.body?.userId)
    const serviceId = toInt(request.body?.serviceId)
    const customerRef = request.body?.customerRef
    const baseAmountIdr = toInt(request.body?.amountIdr)
    const amountPi = Number(request.body?.amountPi || 0)
    const productType = ['prepaid', 'postpaid', 'general'].includes(String(request.body?.productType || '').toLowerCase())
      ? String(request.body?.productType || '').toLowerCase()
      : 'general'
    const productCode = request.body?.productCode ? String(request.body.productCode) : null

    if (!userId || !serviceId || !customerRef || !baseAmountIdr) {
      return reply.code(400).send({ message: 'userId, serviceId, customerRef, amountIdr are required' })
    }

    const pricing = await computePpobPricing(app.mysql, {
      userId,
      serviceId,
      baseAmountIdr,
      amountPi,
      productType,
      productCode,
    })
    if (!pricing) {
      return reply.code(404).send({ message: 'PPOB service not found' })
    }

    const membership = pricing.membership
    const markupIdr = pricing.pricing.markupIdr
    const amountIdr = pricing.pricing.amountIdr
    const adminFeeIdr = pricing.pricing.adminFeeIdr
    const totalIdr = pricing.pricing.totalIdr
    const totalPi = pricing.totalPi
    const finalAmountPi = pricing.amountPi
    const adminFeePi = pricing.adminFeePi

    const [result] = await app.mysql.query(
      `INSERT INTO ppob_transactions
       (user_id, service_id, membership_level_id, membership_code, product_type, product_code, customer_ref,
        base_amount_idr, markup_idr, amount_idr, amount_pi, admin_fee_idr, admin_fee_pi, total_idr, total_pi, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success')`,
      [
        userId,
        serviceId,
        membership?.level_id || null,
        membership?.code || null,
        productType,
        productCode,
        customerRef,
        baseAmountIdr,
        markupIdr,
        amountIdr,
        finalAmountPi,
        adminFeeIdr,
        adminFeePi,
        totalIdr,
        totalPi,
      ],
    )

    return reply.code(201).send({
      id: result.insertId,
      userId,
      serviceId,
      membership: {
        levelId: membership?.level_id || null,
        code: membership?.code || null,
        name: membership?.display_name || null,
      },
      pricing: {
        productType,
        productCode,
        baseAmountIdr,
        markupIdr,
        amountIdr,
        adminFeeIdr,
        totalIdr,
      },
      customerRef,
      amountIdr,
      amountPi: finalAmountPi,
      adminFeeIdr,
      adminFeePi,
      totalIdr,
      totalPi,
      status: 'success',
    })
    },
  )

  app.get(
    '/transactions',
    {
      schema: {
        tags: ['PPOB'],
        summary: 'List PPOB transactions by user',
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                user_id: { type: 'integer' },
                membership_code: { type: ['string', 'null'] },
                product_type: { type: 'string' },
                product_code: { type: ['string', 'null'] },
                customer_ref: { type: 'string' },
                base_amount_idr: { type: 'number' },
                markup_idr: { type: 'number' },
                amount_idr: { type: 'number' },
                amount_pi: { type: 'number' },
                admin_fee_idr: { type: 'number' },
                admin_fee_pi: { type: 'number' },
                total_idr: { type: 'number' },
                total_pi: { type: 'number' },
                status: { type: 'string' },
                created_at: { type: 'string' },
                service_code: { type: 'string' },
                service_name: { type: 'string' },
              },
            },
          },
          400: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
    const userId = toInt(request.query.userId)
    if (!userId) {
      return reply.code(400).send({ message: 'userId is required' })
    }

    const [rows] = await app.mysql.query(
      `SELECT t.id, t.user_id, t.membership_code, t.product_type, t.product_code, t.customer_ref,
              t.base_amount_idr, t.markup_idr, t.amount_idr, t.amount_pi, t.admin_fee_idr, t.admin_fee_pi,
              t.total_idr, t.total_pi, t.status, t.created_at,
              s.code AS service_code, s.name AS service_name
       FROM ppob_transactions t
       JOIN ppob_services s ON s.id = t.service_id
       WHERE t.user_id = ?
       ORDER BY t.id DESC`,
      [userId],
    )

    return rows
    },
  )
}
