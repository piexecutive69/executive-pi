import { createDuitkuInvoice } from '../integrations/duitku.js'

function toInt(value) {
  return Number(value || 0)
}

function makeExternalRef(prefix, id) {
  const stamp = Date.now()
  return `${prefix}-${id}-${stamp}`
}

export async function walletRoutes(app) {
  app.get(
    '/balance',
    {
      schema: {
        tags: ['Wallet'],
        summary: 'Get user wallet balances',
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              idr_balance: { type: 'number' },
              pi_balance: { type: 'number' },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
    const userId = toInt(request.query.userId)
    if (!userId) {
      return reply.code(400).send({ message: 'userId is required' })
    }

    const [rows] = await app.mysql.query('SELECT id, idr_balance, pi_balance FROM users WHERE id = ?', [userId])
    if (!rows.length) {
      return reply.code(404).send({ message: 'User not found' })
    }

    return rows[0]
    },
  )

  app.post(
    '/topup/duitku',
    {
      schema: {
        tags: ['Wallet'],
        summary: 'Create Duitku invoice for wallet topup IDR',
        body: {
          type: 'object',
          required: ['userId', 'amountIdr'],
          properties: {
            userId: { type: 'integer' },
            amountIdr: { type: 'integer' },
            adminFeeIdr: { type: 'integer' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              topupId: { type: 'integer' },
              userId: { type: 'integer' },
              amountIdr: { type: 'number' },
              adminFeeIdr: { type: 'number' },
              totalIdr: { type: 'number' },
              status: { type: 'string' },
              externalReference: { type: 'string' },
              paymentReference: { type: ['string', 'null'] },
              paymentUrl: { type: ['string', 'null'] },
              qrString: { type: ['string', 'null'] },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
          500: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
    const userId = toInt(request.body?.userId)
    const amountIdr = toInt(request.body?.amountIdr)
    const adminFeeIdr = toInt(request.body?.adminFeeIdr || 0)

    if (!userId || amountIdr <= 0) {
      return reply.code(400).send({ message: 'userId and amountIdr > 0 are required' })
    }

    const conn = await app.mysql.getConnection()
    try {
      await conn.beginTransaction()

      const [users] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId])
      if (!users.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'User not found' })
      }

      const totalIdr = amountIdr + adminFeeIdr
      const [gatewayRows] = await conn.query("SELECT id FROM payment_gateways WHERE code = 'duitku' LIMIT 1")
      if (!gatewayRows.length) {
        await conn.rollback()
        return reply.code(500).send({ message: 'Duitku gateway config is missing in payment_gateways table' })
      }

      const [topupResult] = await conn.query(
        `INSERT INTO wallet_topups (user_id, amount_idr, admin_fee_idr, total_idr, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [userId, amountIdr, adminFeeIdr, totalIdr],
      )
      const topupId = topupResult.insertId
      const externalReference = makeExternalRef('DUITKU-TOPUP', topupId)
      const duitkuInvoice = await createDuitkuInvoice({
        merchantCode: process.env.DUITKU_MERCHANT_CODE,
        apiKey: process.env.DUITKU_API_KEY,
        environment: process.env.DUITKU_ENV || 'sandbox',
        paymentMethod: process.env.DUITKU_PAYMENT_METHOD || 'VC',
        merchantOrderId: externalReference,
        paymentAmount: totalIdr,
        productDetails: `Topup Saldo IDR PI Store (${amountIdr})`,
        callbackUrl: process.env.DUITKU_TOPUP_CALLBACK_URL || process.env.DUITKU_CALLBACK_URL,
        returnUrl: process.env.DUITKU_RETURN_URL,
      })
      const paymentUrl = duitkuInvoice.paymentUrl
      const paymentReference = duitkuInvoice.gatewayResponse?.reference || null
      const qrString = duitkuInvoice.gatewayResponse?.qrString || null

      const [paymentResult] = await conn.query(
        `INSERT INTO payment_transactions
         (user_id, gateway_id, source_type, source_reference_id, external_reference, amount_idr, amount_pi, status, request_payload)
         VALUES (?, ?, 'wallet_topup', ?, ?, ?, 0, 'pending', ?)`,
        [
          userId,
          gatewayRows[0].id,
          topupId,
          externalReference,
          totalIdr,
          JSON.stringify({
            method: 'duitku',
            type: 'wallet_topup',
            topupId,
            amountIdr,
            adminFeeIdr,
            totalIdr,
            duitku: duitkuInvoice.gatewayResponse,
          }),
        ],
      )

      await conn.query(
        `UPDATE wallet_topups
         SET duitku_reference = ?, payment_url = ?, payment_transaction_id = ?, request_payload = ?
         WHERE id = ?`,
        [
          externalReference,
          paymentUrl,
          paymentResult.insertId,
          JSON.stringify({ externalReference, paymentUrl }),
          topupId,
        ],
      )

      await conn.commit()
      return reply.code(201).send({
        topupId,
        userId,
        amountIdr,
        adminFeeIdr,
        totalIdr,
        status: 'pending',
        externalReference,
        paymentReference,
        paymentUrl,
        qrString,
      })
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
    },
  )

  app.post(
    '/topup/duitku/callback',
    {
      schema: {
        tags: ['Wallet'],
        summary: 'Duitku callback for wallet topup',
        security: [],
        body: {
          type: 'object',
          properties: {
            merchantOrderId: { type: 'string' },
            reference: { type: 'string' },
            externalReference: { type: 'string' },
            resultCode: { type: 'string' },
            status: { type: 'string' },
          },
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
    const reference = request.body?.merchantOrderId || request.body?.reference || request.body?.externalReference
    const paid = String(request.body?.resultCode || '').toUpperCase() === '00' || String(request.body?.status || '').toLowerCase() === 'paid'

    if (!reference) {
      return reply.code(400).send({ message: 'reference is required' })
    }

    const conn = await app.mysql.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.query(
        `SELECT wt.id, wt.user_id, wt.amount_idr, wt.status, wt.payment_transaction_id
         FROM wallet_topups wt
         WHERE wt.duitku_reference = ?
         FOR UPDATE`,
        [reference],
      )

      if (!rows.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'Topup reference not found' })
      }

      const topup = rows[0]
      if (topup.status === 'paid') {
        await conn.rollback()
        return { ok: true, message: 'Already processed' }
      }

      if (!paid) {
        await conn.query(
          `UPDATE wallet_topups SET status = 'failed', callback_payload = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(request.body || {}), topup.id],
        )
        await conn.query(
          `UPDATE payment_transactions SET status = 'failed', response_payload = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(request.body || {}), topup.payment_transaction_id],
        )
        await conn.commit()
        return { ok: true, status: 'failed' }
      }

      await conn.query('UPDATE users SET idr_balance = idr_balance + ? WHERE id = ?', [topup.amount_idr, topup.user_id])

      await conn.query(
        `UPDATE wallet_topups
         SET status = 'paid', callback_payload = ?, paid_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(request.body || {}), topup.id],
      )

      await conn.query(
        `UPDATE payment_transactions
         SET status = 'paid', response_payload = ?, paid_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(request.body || {}), topup.payment_transaction_id],
      )

      await conn.commit()
      return { ok: true, status: 'paid' }
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
    },
  )
}
