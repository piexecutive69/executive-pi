import { createDuitkuInvoice } from '../integrations/duitku.js'

function toInt(value) {
  return Number(value || 0)
}

function makeExternalRef(prefix, id) {
  const stamp = Date.now()
  return `${prefix}-${id}-${stamp}`
}

function isPaidCallback(payload) {
  const resultCode = String(payload?.resultCode || '').toUpperCase()
  const status = String(payload?.status || payload?.transactionStatus || '').toLowerCase()
  return resultCode === '00' || status === 'paid' || status === 'success' || status === 'settlement'
}

export async function orderRoutes(app) {
  app.post(
    '/checkout',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Checkout cart to order (IDR only)',
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'integer' },
            paymentMethod: { type: 'string', enum: ['wallet_idr', 'duitku'] },
            shippingAddress: { type: ['string', 'null'] },
            shippingIdr: { type: 'integer' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              orderId: { type: 'integer' },
              status: { type: 'string' },
              subtotalIdr: { type: 'number' },
              shippingIdr: { type: 'number' },
              totalIdr: { type: 'number' },
              currency: { type: 'string' },
              payment: { type: ['object', 'null'], additionalProperties: true },
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
    const paymentMethod = request.body?.paymentMethod || 'wallet_idr'
    const shippingAddress = request.body?.shippingAddress || null
    const shippingIdr = toInt(request.body?.shippingIdr || 12000)

    if (!userId) {
      return reply.code(400).send({ message: 'userId is required' })
    }

    if (!['wallet_idr', 'duitku'].includes(paymentMethod)) {
      return reply.code(400).send({ message: 'paymentMethod must be wallet_idr or duitku' })
    }

    const conn = await app.mysql.getConnection()
    try {
      await conn.beginTransaction()

      const [users] = await conn.query('SELECT id, idr_balance, name, email, phone FROM users WHERE id = ? FOR UPDATE', [userId])
      if (!users.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'User not found' })
      }

      const [cartItems] = await conn.query(
        `SELECT ci.id, ci.product_id, ci.qty, p.name, p.price_idr, p.stock
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         WHERE ci.user_id = ?
         FOR UPDATE`,
        [userId],
      )

      if (!cartItems.length) {
        await conn.rollback()
        return reply.code(400).send({ message: 'Cart is empty' })
      }

      for (const item of cartItems) {
        if (item.qty > item.stock) {
          await conn.rollback()
          return reply.code(400).send({ message: `Stock is not enough for ${item.name}` })
        }
      }

      const subtotalIdr = cartItems.reduce((sum, item) => sum + Number(item.price_idr) * item.qty, 0)
      const totalIdr = subtotalIdr + shippingIdr

      const initialStatus = paymentMethod === 'wallet_idr' ? 'paid' : 'waiting_payment'
      const [orderResult] = await conn.query(
        `INSERT INTO orders
         (user_id, status, subtotal_idr, subtotal_pi, shipping_idr, shipping_pi, total_idr, total_pi, payment_method, shipping_address)
         VALUES (?, ?, ?, 0, ?, 0, ?, 0, ?, ?)`,
        [userId, initialStatus, subtotalIdr, shippingIdr, totalIdr, paymentMethod, shippingAddress],
      )
      const orderId = orderResult.insertId

      for (const item of cartItems) {
        const lineTotalIdr = Number(item.price_idr) * item.qty
        await conn.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, qty, unit_price_idr, unit_price_pi, line_total_idr, line_total_pi)
           VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
          [orderId, item.product_id, item.name, item.qty, item.price_idr, lineTotalIdr],
        )

        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.product_id])
      }

      let payment = null

      if (paymentMethod === 'wallet_idr') {
        if (Number(users[0].idr_balance) < totalIdr) {
          await conn.rollback()
          return reply.code(400).send({
            message: 'Insufficient wallet IDR balance',
            required: totalIdr,
            current: Number(users[0].idr_balance),
          })
        }

        await conn.query('UPDATE users SET idr_balance = idr_balance - ? WHERE id = ?', [totalIdr, userId])
        payment = {
          method: 'wallet_idr',
          status: 'paid',
          amountIdr: totalIdr,
        }
      } else {
        const [gatewayRows] = await conn.query("SELECT id FROM payment_gateways WHERE code = 'duitku' LIMIT 1")
        if (!gatewayRows.length) {
          await conn.rollback()
          return reply.code(500).send({ message: 'Duitku gateway config is missing in payment_gateways table' })
        }

        const externalReference = makeExternalRef('DUITKU-ORDER', orderId)
        const duitkuInvoice = await createDuitkuInvoice({
          merchantCode: process.env.DUITKU_MERCHANT_CODE,
          apiKey: process.env.DUITKU_API_KEY,
          environment: process.env.DUITKU_ENV || 'sandbox',
          merchantOrderId: externalReference,
          paymentAmount: totalIdr,
          productDetails: `Checkout Order #${orderId}`,
          customerName: users[0].name,
          email: users[0].email,
          phoneNumber: users[0].phone,
          callbackUrl: process.env.DUITKU_ORDER_CALLBACK_URL || 'http://localhost:3100/api/orders/duitku/callback',
          returnUrl: process.env.DUITKU_RETURN_URL,
        })
        const paymentUrl = duitkuInvoice.paymentUrl

        const [paymentResult] = await conn.query(
          `INSERT INTO payment_transactions
           (user_id, gateway_id, source_type, source_reference_id, external_reference, amount_idr, amount_pi, status, request_payload)
           VALUES (?, ?, 'order', ?, ?, ?, 0, 'pending', ?)`,
          [
            userId,
            gatewayRows[0].id,
            orderId,
            externalReference,
            totalIdr,
            JSON.stringify({
              method: 'duitku',
              orderId,
              amountIdr: totalIdr,
              shippingAddress,
              duitku: duitkuInvoice.gatewayResponse,
            }),
          ],
        )

        payment = {
          method: 'duitku',
          status: 'pending',
          paymentTransactionId: paymentResult.insertId,
          externalReference,
          paymentUrl,
        }
      }

      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId])
      await conn.commit()

      return reply.code(201).send({
        orderId,
        status: initialStatus,
        subtotalIdr,
        shippingIdr,
        totalIdr,
        currency: 'IDR',
        payment,
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
    '/duitku/callback',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Duitku callback for order payment',
        security: [],
        body: {
          type: 'object',
          properties: {
            merchantOrderId: { type: 'string' },
            reference: { type: 'string' },
            externalReference: { type: 'string' },
            resultCode: { type: 'string' },
            status: { type: 'string' },
            transactionStatus: { type: 'string' },
          },
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              status: { type: 'string' },
              orderId: { type: 'integer' },
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
    if (!reference) {
      return reply.code(400).send({ message: 'reference is required' })
    }

    const isPaid = isPaidCallback(request.body)
    const conn = await app.mysql.getConnection()

    try {
      await conn.beginTransaction()

      const [payments] = await conn.query(
        `SELECT id, source_reference_id, status
         FROM payment_transactions
         WHERE source_type = 'order' AND external_reference = ?
         FOR UPDATE`,
        [reference],
      )

      if (!payments.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'Payment reference not found' })
      }

      const payment = payments[0]
      const orderId = Number(payment.source_reference_id)
      const [orders] = await conn.query('SELECT id, user_id, status FROM orders WHERE id = ? FOR UPDATE', [orderId])

      if (!orders.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'Order not found' })
      }

      const order = orders[0]
      if (order.status === 'paid') {
        await conn.rollback()
        return { ok: true, message: 'Order already paid' }
      }

      if (isPaid) {
        await conn.query(
          `UPDATE payment_transactions
           SET status = 'paid', response_payload = ?, paid_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [JSON.stringify(request.body || {}), payment.id],
        )

        await conn.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?", [orderId])
        await conn.commit()
        return { ok: true, status: 'paid', orderId }
      }

      if (order.status !== 'cancelled') {
        const [items] = await conn.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [orderId])
        for (const item of items) {
          await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id])
        }
      }

      await conn.query(
        `UPDATE payment_transactions
         SET status = 'failed', response_payload = ?, updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(request.body || {}), payment.id],
      )
      await conn.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [orderId])

      await conn.commit()
      return { ok: true, status: 'failed', orderId }
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
    },
  )

  app.get(
    '/',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List orders by user',
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
                status: { type: 'string' },
                subtotal_idr: { type: 'number' },
                shipping_idr: { type: 'number' },
                total_idr: { type: 'number' },
                payment_method: { type: 'string' },
                shipping_address: { type: ['string', 'null'] },
                created_at: { type: 'string' },
              },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
    const userId = toInt(request.query.userId)
    if (!userId) {
      return reply.code(400).send({ message: 'userId is required' })
    }

    const [rows] = await app.mysql.query(
      `SELECT id, user_id, status, subtotal_idr, shipping_idr, total_idr, payment_method, shipping_address, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY id DESC`,
      [userId],
    )

    return rows
    },
  )

  app.get(
    '/:orderId',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get order detail by order id',
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'integer' },
          },
        },
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
              user_id: { type: 'integer' },
              status: { type: 'string' },
              subtotal_idr: { type: 'number' },
              shipping_idr: { type: 'number' },
              total_idr: { type: 'number' },
              payment_method: { type: 'string' },
              shipping_address: { type: ['string', 'null'] },
              created_at: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_id: { type: 'integer' },
                    product_name: { type: 'string' },
                    qty: { type: 'integer' },
                    unit_price_idr: { type: 'number' },
                    line_total_idr: { type: 'number' },
                  },
                },
              },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
    const orderId = toInt(request.params.orderId)
    const userId = toInt(request.query.userId)
    if (!orderId || !userId) {
      return reply.code(400).send({ message: 'orderId and userId are required' })
    }

    const [orders] = await app.mysql.query(
      `SELECT id, user_id, status, subtotal_idr, shipping_idr, total_idr, payment_method, shipping_address, created_at
       FROM orders
       WHERE id = ? AND user_id = ?`,
      [orderId, userId],
    )

    if (!orders.length) {
      return reply.code(404).send({ message: 'Order not found' })
    }

    const [items] = await app.mysql.query(
      `SELECT product_id, product_name, qty, unit_price_idr, line_total_idr
       FROM order_items
       WHERE order_id = ?`,
      [orderId],
    )

    return {
      ...orders[0],
      items,
    }
    },
  )
}
