import { approvePiPayment, completePiPayment, getPiPayment } from '../integrations/piPlatform.js'
import { resolvePiContextFromRequest } from '../lib/piContext.js'

function toInt(value) {
  return Number(value || 0)
}

function makeExternalRef(prefix, id) {
  const stamp = Date.now()
  return `${prefix}-${id}-${stamp}`
}

function normalizeIdempotencyKey(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  return value.slice(0, 120)
}

function parseJsonValue(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

function isPaidCallback(payload) {
  const resultCode = String(payload?.resultCode || '').toUpperCase()
  const status = String(payload?.status || payload?.transactionStatus || '').toLowerCase()
  return resultCode === '00' || status === 'paid' || status === 'success' || status === 'settlement'
}

function toMoneyPi(value) {
  const num = Number(value || 0)
  if (!Number.isFinite(num) || num < 0) return 0
  return Number(num.toFixed(4))
}

async function hasCompletedShippingAddress(conn, userId) {
  const [rows] = await conn.query(
    `SELECT user_id
     FROM user_addresses
     WHERE user_id = ?
       AND COALESCE(NULLIF(TRIM(address_line), ''), NULL) IS NOT NULL
       AND province_id IS NOT NULL
       AND regency_id IS NOT NULL
       AND district_id IS NOT NULL
       AND village_id IS NOT NULL
     LIMIT 1`,
    [userId],
  )
  return rows.length > 0
}

function toNullableString(value) {
  if (value === undefined || value === null) return null
  const parsed = String(value).trim()
  return parsed || null
}

function extractWalletAddressFromPiPayment(piPayment) {
  return (
    toNullableString(piPayment?.from_address) ||
    toNullableString(piPayment?.fromAddress) ||
    toNullableString(piPayment?.payer_address) ||
    toNullableString(piPayment?.payerAddress) ||
    toNullableString(piPayment?.transaction?.from_address) ||
    toNullableString(piPayment?.transaction?.fromAddress) ||
    toNullableString(piPayment?.transaction?.from) ||
    toNullableString(piPayment?.metadata?.walletAddress) ||
    toNullableString(piPayment?.metadata?.wallet_address)
  )
}

function extractPiUidFromPayment(piPayment, fallbackUserId) {
  const piUid =
    toNullableString(piPayment?.user_uid) ||
    toNullableString(piPayment?.userUid) ||
    toNullableString(piPayment?.metadata?.userUid) ||
    toNullableString(piPayment?.metadata?.piUid)
  if (piUid) return piUid
  if (!fallbackUserId) return null
  return `user_${fallbackUserId}`
}

async function syncUserWalletFromPiPayment(conn, { userId, piPayment }) {
  const safeUserId = toInt(userId)
  if (!safeUserId || !piPayment) return

  const walletAddress = extractWalletAddressFromPiPayment(piPayment)
  const piUid = extractPiUidFromPayment(piPayment, safeUserId)
  if (!walletAddress && !piUid) return

  const [existingRows] = await conn.query(
    `SELECT pi_uid, pi_username, wallet_address, wallet_secret_id, last_pi_balance
     FROM user_pi_wallets
     WHERE user_id = ?
     LIMIT 1`,
    [safeUserId],
  )
  const existing = existingRows[0] || null
  const finalPiUid = piUid || toNullableString(existing?.pi_uid) || `user_${safeUserId}`
  const finalWalletAddress = walletAddress || toNullableString(existing?.wallet_address)
  const finalWalletSecretId = toNullableString(existing?.wallet_secret_id) || `pi_uid:${finalPiUid}`
  const finalPiUsername =
    toNullableString(piPayment?.user_name) ||
    toNullableString(piPayment?.metadata?.username) ||
    toNullableString(existing?.pi_username)
  const finalPiBalanceRaw = Number(existing?.last_pi_balance ?? 0)
  const finalPiBalance = Number.isFinite(finalPiBalanceRaw) ? Math.max(0, finalPiBalanceRaw) : 0

  await conn.query(
    `INSERT INTO user_pi_wallets
       (user_id, pi_uid, pi_username, wallet_address, wallet_secret_id, last_pi_balance, last_synced_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       pi_uid = VALUES(pi_uid),
       pi_username = VALUES(pi_username),
       wallet_address = COALESCE(VALUES(wallet_address), wallet_address),
       wallet_secret_id = VALUES(wallet_secret_id),
       last_synced_at = NOW(),
       metadata_json = VALUES(metadata_json)`,
    [
      safeUserId,
      finalPiUid,
      finalPiUsername,
      finalWalletAddress,
      finalWalletSecretId,
      finalPiBalance,
      JSON.stringify({
        source: 'orders_pi_callback',
        paymentIdentifier: toNullableString(piPayment?.identifier) || null,
        extracted: {
          piUid: finalPiUid,
          walletAddress: finalWalletAddress,
        },
      }),
    ],
  )
}

async function upsertPiPaymentRecord(conn, { orderId, paymentId, piPayment = null, txid = null, callbackStage = null }) {
  const payment = piPayment || {}
  const paymentIdentifier = toNullableString(payment?.identifier) || toNullableString(paymentId)
  if (!paymentIdentifier || !orderId) return

  await conn.query(
    `INSERT INTO pi_payment_records
       (order_id, payment_identifier, txid, network, direction, user_uid, from_address, to_address, cancelled, user_cancelled, developer_approved, developer_completed, transaction_verified, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       order_id = VALUES(order_id),
       txid = COALESCE(VALUES(txid), txid),
       network = VALUES(network),
       direction = VALUES(direction),
       user_uid = VALUES(user_uid),
       from_address = VALUES(from_address),
       to_address = VALUES(to_address),
       cancelled = VALUES(cancelled),
       user_cancelled = VALUES(user_cancelled),
       developer_approved = VALUES(developer_approved),
       developer_completed = VALUES(developer_completed),
       transaction_verified = VALUES(transaction_verified),
       raw_payload = VALUES(raw_payload),
       updated_at = NOW()`,
    [
      Number(orderId),
      paymentIdentifier,
      toNullableString(txid) || toNullableString(payment?.transaction?.txid),
      toNullableString(payment?.network),
      toNullableString(payment?.direction),
      toNullableString(payment?.user_uid) || toNullableString(payment?.userUid),
      toNullableString(payment?.from_address) || toNullableString(payment?.fromAddress),
      toNullableString(payment?.to_address) || toNullableString(payment?.toAddress),
      Boolean(payment?.status?.cancelled),
      Boolean(payment?.status?.user_cancelled),
      Boolean(payment?.status?.developer_approved),
      Boolean(payment?.status?.developer_completed),
      Boolean(payment?.status?.transaction_verified),
      JSON.stringify({
        stage: callbackStage || null,
        payment: payment || null,
      }),
    ],
  )
}

async function readIdempotencyResponse(conn, { endpoint, key }) {
  if (!endpoint || !key) return null
  const [rows] = await conn.query(
    `SELECT response_code, response_json
     FROM api_idempotency_keys
     WHERE endpoint = ? AND idem_key = ?
     LIMIT 1`,
    [endpoint, key],
  )
  if (!rows.length) return null
  return {
    code: Number(rows[0].response_code || 200),
    body: parseJsonValue(rows[0].response_json) || {},
  }
}

async function saveIdempotencyResponse(conn, { endpoint, key, orderId = null, paymentId = null, code = 200, body = {} }) {
  if (!endpoint || !key) return
  await conn.query(
    `INSERT INTO api_idempotency_keys
       (endpoint, idem_key, order_id, payment_id, response_code, response_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       response_code = VALUES(response_code),
       response_json = VALUES(response_json),
       updated_at = NOW()`,
    [endpoint, key, orderId ? Number(orderId) : null, toNullableString(paymentId), Number(code || 200), JSON.stringify(body || {})],
  )
}

async function getPiGatewayId(conn) {
  const [gatewayRows] = await conn.query("SELECT id FROM payment_gateways WHERE code = 'pi_sdk' LIMIT 1")
  if (!gatewayRows.length) {
    throw new Error('Pi SDK gateway config is missing in payment_gateways table')
  }
  return Number(gatewayRows[0].id)
}

export async function orderRoutes(app) {
  await app.mysql.query(
    `CREATE TABLE IF NOT EXISTS pi_payment_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      payment_identifier VARCHAR(140) NOT NULL,
      txid VARCHAR(140) NULL,
      network VARCHAR(80) NULL,
      direction VARCHAR(80) NULL,
      user_uid VARCHAR(140) NULL,
      from_address VARCHAR(255) NULL,
      to_address VARCHAR(255) NULL,
      cancelled TINYINT(1) NOT NULL DEFAULT 0,
      user_cancelled TINYINT(1) NOT NULL DEFAULT 0,
      developer_approved TINYINT(1) NOT NULL DEFAULT 0,
      developer_completed TINYINT(1) NOT NULL DEFAULT 0,
      transaction_verified TINYINT(1) NOT NULL DEFAULT 0,
      raw_payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pi_payment_identifier (payment_identifier),
      KEY idx_pi_payment_order (order_id)
    )`,
  )

  await app.mysql.query(
    `CREATE TABLE IF NOT EXISTS api_idempotency_keys (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      endpoint VARCHAR(80) NOT NULL,
      idem_key VARCHAR(120) NOT NULL,
      order_id INT NULL,
      payment_id VARCHAR(140) NULL,
      response_code INT NOT NULL DEFAULT 200,
      response_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_idem_endpoint_key (endpoint, idem_key),
      KEY idx_idem_order (order_id),
      KEY idx_idem_payment (payment_id)
    )`,
  )

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
            paymentMethod: { type: 'string', enum: ['wallet_idr', 'pi_sdk'] },
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

    if (!['wallet_idr', 'pi_sdk'].includes(paymentMethod)) {
      return reply.code(400).send({ message: 'paymentMethod must be wallet_idr or pi_sdk' })
    }

    if (paymentMethod === 'pi_sdk') {
      return reply.code(400).send({
        message: 'Flow Pi SDK sudah diperbarui. Refresh aplikasi lalu ulangi checkout Pi SDK.',
      })
    }

    const conn = await app.mysql.getConnection()
    try {
      await conn.beginTransaction()

      const [users] = await conn.query('SELECT id, idr_balance, name, email, phone FROM users WHERE id = ? FOR UPDATE', [userId])
      if (!users.length) {
        await conn.rollback()
        return reply.code(404).send({ message: 'User not found' })
      }
      const hasAddress = await hasCompletedShippingAddress(conn, userId)
      if (!hasAddress) {
        await conn.rollback()
        return reply.code(400).send({
          message: 'Alamat pengiriman belum diisi. Lengkapi alamat di menu Profile > Settings terlebih dahulu.',
        })
      }

      const [cartItems] = await conn.query(
        `SELECT ci.id, ci.product_id, ci.qty, p.name, p.price_idr, p.price_pi, p.stock
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
      const subtotalPi = cartItems.reduce((sum, item) => sum + Number(item.price_pi || 0) * item.qty, 0)
      const shippingPi = 0
      const totalIdr = subtotalIdr + shippingIdr
      const totalPi = subtotalPi + shippingPi

      const initialStatus = paymentMethod === 'pi_sdk' ? 'waiting_payment' : 'paid'
      const [orderResult] = await conn.query(
        `INSERT INTO orders
         (user_id, status, subtotal_idr, subtotal_pi, shipping_idr, shipping_pi, total_idr, total_pi, payment_method, shipping_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, initialStatus, subtotalIdr, subtotalPi, shippingIdr, shippingPi, totalIdr, totalPi, paymentMethod, shippingAddress],
      )
      const orderId = orderResult.insertId

      for (const item of cartItems) {
        const lineTotalIdr = Number(item.price_idr) * item.qty
        await conn.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, qty, unit_price_idr, unit_price_pi, line_total_idr, line_total_pi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.name, item.qty, item.price_idr, Number(item.price_pi || 0), lineTotalIdr, Number(item.price_pi || 0) * item.qty],
        )

        if (paymentMethod !== 'pi_sdk') {
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.product_id])
        }
      }

      let payment = null

      if (paymentMethod === 'pi_sdk') {
        const gatewayId = await getPiGatewayId(conn)
        await conn.query(
          `INSERT INTO payment_transactions
           (user_id, gateway_id, source_type, source_reference_id, external_reference, amount_idr, amount_pi, status, request_payload)
           VALUES (?, ?, 'order', ?, NULL, 0, ?, 'pending', ?)`,
          [
            userId,
            gatewayId,
            orderId,
            totalPi,
            JSON.stringify({
              method: 'pi_sdk',
              flow: 'on_chain',
              orderId,
              amountPi: totalPi,
              shippingAddress,
              source: 'legacy_checkout',
            }),
          ],
        )

        payment = {
          method: 'pi_sdk',
          flow: 'on_chain',
          status: 'waiting_payment',
          amountPi: totalPi,
          paymentData: {
            amount: totalPi,
            memo: `PI Store Order #${orderId}`,
            metadata: {
              orderId,
              userId,
              source: 'pi_store_order',
            },
          },
        }
      }

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
      }

      if (paymentMethod !== 'pi_sdk') {
        await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId])
      }
      await conn.commit()

      return reply.code(201).send({
        orderId,
        status: initialStatus,
        subtotalIdr,
        subtotalPi,
        shippingIdr,
        shippingPi,
        totalIdr,
        totalPi,
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
    '/pi/initiate',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create waiting payment order for Pi on-chain payment',
      },
    },
    async (request, reply) => {
      const userId = toInt(request.body?.userId)
      const shippingAddress = request.body?.shippingAddress || null
      const shippingIdr = toInt(request.body?.shippingIdr || 12000)
      if (!userId) {
        return reply.code(400).send({ message: 'userId is required' })
      }
      const idempotencyKey = normalizeIdempotencyKey(
        request.headers?.['x-idempotency-key'] || request.body?.idempotencyKey,
      )

      const conn = await app.mysql.getConnection()
      try {
        if (idempotencyKey) {
          const cached = await readIdempotencyResponse(conn, {
            endpoint: 'pi_initiate',
            key: idempotencyKey,
          })
          if (cached) {
            return reply.code(cached.code).send(cached.body)
          }
        }
        await conn.beginTransaction()

        const [users] = await conn.query('SELECT id, name, email, phone FROM users WHERE id = ? FOR UPDATE', [userId])
        if (!users.length) {
          await conn.rollback()
          return reply.code(404).send({ message: 'User not found' })
        }
        const hasAddress = await hasCompletedShippingAddress(conn, userId)
        if (!hasAddress) {
          await conn.rollback()
          return reply.code(400).send({
            message: 'Alamat pengiriman belum diisi. Lengkapi alamat di menu Profile > Settings terlebih dahulu.',
          })
        }

        const [cartItems] = await conn.query(
          `SELECT ci.id, ci.product_id, ci.qty, p.name, p.price_idr, p.price_pi, p.stock
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
          if (Number(item.qty) > Number(item.stock)) {
            await conn.rollback()
            return reply.code(400).send({ message: `Stock is not enough for ${item.name}` })
          }
        }

        const subtotalIdr = cartItems.reduce((sum, item) => sum + Number(item.price_idr) * Number(item.qty), 0)
        const subtotalPi = cartItems.reduce((sum, item) => sum + Number(item.price_pi || 0) * Number(item.qty), 0)
        const shippingPi = 0
        const totalIdr = subtotalIdr + shippingIdr
        const totalPi = toMoneyPi(subtotalPi + shippingPi)
        if (totalPi <= 0) {
          await conn.rollback()
          return reply.code(400).send({ message: 'Total Pi must be greater than 0 for Pi payment' })
        }

        const [orderResult] = await conn.query(
          `INSERT INTO orders
           (user_id, status, subtotal_idr, subtotal_pi, shipping_idr, shipping_pi, total_idr, total_pi, payment_method, shipping_address)
           VALUES (?, 'waiting_payment', ?, ?, ?, ?, ?, ?, 'pi_sdk', ?)`,
          [userId, subtotalIdr, subtotalPi, shippingIdr, shippingPi, totalIdr, totalPi, shippingAddress],
        )
        const orderId = Number(orderResult.insertId)

        for (const item of cartItems) {
          const qty = Number(item.qty || 0)
          const unitPriceIdr = Number(item.price_idr || 0)
          const unitPricePi = Number(item.price_pi || 0)
          await conn.query(
            `INSERT INTO order_items
             (order_id, product_id, product_name, qty, unit_price_idr, unit_price_pi, line_total_idr, line_total_pi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.product_id, item.name, qty, unitPriceIdr, unitPricePi, unitPriceIdr * qty, unitPricePi * qty],
          )
        }

        const gatewayId = await getPiGatewayId(conn)
        await conn.query(
          `INSERT INTO payment_transactions
           (user_id, gateway_id, source_type, source_reference_id, external_reference, amount_idr, amount_pi, status, request_payload)
           VALUES (?, ?, 'order', ?, NULL, 0, ?, 'pending', ?)`,
          [
            userId,
            gatewayId,
            orderId,
            totalPi,
            JSON.stringify({
              method: 'pi_sdk',
              flow: 'on_chain',
              orderId,
              amountPi: totalPi,
              shippingAddress,
            }),
          ],
        )

        const responseBody = {
          orderId,
          status: 'waiting_payment',
          amountPi: totalPi,
          paymentData: {
            amount: totalPi,
            memo: `PI Store Order #${orderId}`,
            metadata: {
              orderId,
              userId,
              source: 'pi_store_order',
            },
          },
        }

        if (idempotencyKey) {
          await saveIdempotencyResponse(conn, {
            endpoint: 'pi_initiate',
            key: idempotencyKey,
            orderId,
            code: 201,
            body: responseBody,
          })
        }

        await conn.commit()
        return reply.code(201).send(responseBody)
      } catch (error) {
        await conn.rollback()
        throw error
      } finally {
        conn.release()
      }
    },
  )

  app.post(
    '/pi/approve',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Approve Pi payment (server callback)',
      },
    },
    async (request, reply) => {
      const piContext = resolvePiContextFromRequest(request)
      const orderId = toInt(request.body?.orderId)
      const paymentId = String(request.body?.paymentId || '').trim()
      const idempotencyKey = normalizeIdempotencyKey(
        request.headers?.['x-idempotency-key'] || request.body?.idempotencyKey,
      )
      if (!orderId || !paymentId) {
        return reply.code(400).send({ message: 'orderId and paymentId are required' })
      }

      const conn = await app.mysql.getConnection()
      try {
        if (idempotencyKey) {
          const cached = await readIdempotencyResponse(conn, {
            endpoint: 'pi_approve',
            key: idempotencyKey,
          })
          if (cached) {
            return reply.code(cached.code).send(cached.body)
          }
        }
        await conn.beginTransaction()
        const [paymentRows] = await conn.query(
          `SELECT pt.id, pt.status, pt.source_reference_id, pt.user_id, o.status AS order_status
           FROM payment_transactions pt
           JOIN orders o ON o.id = pt.source_reference_id
           WHERE pt.source_type = 'order' AND pt.source_reference_id = ?
           ORDER BY pt.id DESC
           LIMIT 1
           FOR UPDATE`,
          [orderId],
        )
        if (!paymentRows.length) {
          await conn.rollback()
          return reply.code(404).send({ message: 'Payment transaction not found' })
        }
        const paymentTx = paymentRows[0]
        if (paymentTx.order_status === 'paid') {
          await conn.rollback()
          return { ok: true, status: 'already_paid', orderId, paymentId }
        }

        const piPayment = await getPiPayment(paymentId, piContext)
        const approveResult = await approvePiPayment(paymentId, piContext)
        await syncUserWalletFromPiPayment(conn, {
          userId: Number(paymentTx.user_id),
          piPayment,
        })

        await conn.query(
          `UPDATE payment_transactions
           SET external_reference = ?, status = 'pending', response_payload = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            paymentId,
            JSON.stringify({
              payment: piPayment,
              approve: approveResult,
            }),
            paymentTx.id,
          ],
        )

        await upsertPiPaymentRecord(conn, {
          orderId,
          paymentId,
          piPayment,
          callbackStage: 'approve',
        })

        const responseBody = {
          ok: true,
          orderId,
          paymentId,
          status: 'approved',
        }
        if (idempotencyKey) {
          await saveIdempotencyResponse(conn, {
            endpoint: 'pi_approve',
            key: idempotencyKey,
            orderId,
            paymentId,
            code: 200,
            body: responseBody,
          })
        }

        await conn.commit()
        return responseBody
      } catch (error) {
        await conn.rollback()
        return reply.code(400).send({ message: error.message || 'Pi approve failed' })
      } finally {
        conn.release()
      }
    },
  )

  app.post(
    '/pi/complete',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Complete Pi payment (server callback)',
      },
    },
    async (request, reply) => {
      const piContext = resolvePiContextFromRequest(request)
      const orderId = toInt(request.body?.orderId)
      const paymentId = String(request.body?.paymentId || '').trim()
      const txid = String(request.body?.txid || '').trim() || null
      const idempotencyKey = normalizeIdempotencyKey(
        request.headers?.['x-idempotency-key'] || request.body?.idempotencyKey,
      )
      if (!orderId || !paymentId) {
        return reply.code(400).send({ message: 'orderId and paymentId are required' })
      }

      const conn = await app.mysql.getConnection()
      try {
        if (idempotencyKey) {
          const cached = await readIdempotencyResponse(conn, {
            endpoint: 'pi_complete',
            key: idempotencyKey,
          })
          if (cached) {
            return reply.code(cached.code).send(cached.body)
          }
        }
        await conn.beginTransaction()

        const [rows] = await conn.query(
          `SELECT o.id, o.user_id, o.status, pt.id AS payment_tx_id, pt.status AS payment_status
           FROM orders o
           JOIN payment_transactions pt
             ON pt.source_type = 'order'
            AND pt.source_reference_id = o.id
           WHERE o.id = ?
           ORDER BY pt.id DESC
           LIMIT 1
           FOR UPDATE`,
          [orderId],
        )
        if (!rows.length) {
          await conn.rollback()
          return reply.code(404).send({ message: 'Order payment not found' })
        }
        const target = rows[0]
        if (target.status === 'paid') {
          await conn.rollback()
          return { ok: true, status: 'already_paid', orderId, paymentId }
        }

        const [items] = await conn.query(
          `SELECT oi.product_id, oi.qty, p.name, p.stock
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = ?
           FOR UPDATE`,
          [orderId],
        )
        for (const item of items) {
          if (Number(item.qty || 0) > Number(item.stock || 0)) {
            await conn.rollback()
            return reply.code(400).send({ message: `Stock is not enough for ${item.name}` })
          }
        }

        const piPayment = await getPiPayment(paymentId, piContext)
        const completeResult = await completePiPayment(paymentId, txid, piContext)
        await syncUserWalletFromPiPayment(conn, {
          userId: Number(target.user_id),
          piPayment,
        })

        for (const item of items) {
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.product_id])
        }

        await conn.query(
          `UPDATE payment_transactions
           SET external_reference = ?, status = 'paid', response_payload = ?, paid_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [
            paymentId,
            JSON.stringify({
              payment: piPayment,
              complete: completeResult,
              txid,
            }),
            target.payment_tx_id,
          ],
        )
        await conn.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?", [orderId])
        await conn.query('DELETE FROM cart_items WHERE user_id = ?', [target.user_id])

        await upsertPiPaymentRecord(conn, {
          orderId,
          paymentId,
          piPayment,
          txid,
          callbackStage: 'complete',
        })

        const responseBody = {
          ok: true,
          status: 'paid',
          orderId,
          paymentId,
        }
        if (idempotencyKey) {
          await saveIdempotencyResponse(conn, {
            endpoint: 'pi_complete',
            key: idempotencyKey,
            orderId,
            paymentId,
            code: 200,
            body: responseBody,
          })
        }

        await conn.commit()
        return responseBody
      } catch (error) {
        await conn.rollback()
        return reply.code(400).send({ message: error.message || 'Pi complete failed' })
      } finally {
        conn.release()
      }
    },
  )

  app.post(
    '/pi/cancel',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Cancel Pi waiting payment order',
      },
    },
    async (request, reply) => {
      const orderId = toInt(request.body?.orderId)
      const paymentId = String(request.body?.paymentId || '').trim() || null
      const idempotencyKey = normalizeIdempotencyKey(
        request.headers?.['x-idempotency-key'] || request.body?.idempotencyKey,
      )
      const reason = String(request.body?.reason || 'cancelled by user')
      if (!orderId) {
        return reply.code(400).send({ message: 'orderId is required' })
      }

      const conn = await app.mysql.getConnection()
      try {
        if (idempotencyKey) {
          const cached = await readIdempotencyResponse(conn, {
            endpoint: 'pi_cancel',
            key: idempotencyKey,
          })
          if (cached) {
            return reply.code(cached.code).send(cached.body)
          }
        }
        await conn.beginTransaction()
        const [orderRows] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [orderId])
        if (!orderRows.length) {
          await conn.rollback()
          return reply.code(404).send({ message: 'Order not found' })
        }
        const order = orderRows[0]
        if (order.status !== 'paid') {
          await conn.query(
            `UPDATE payment_transactions
             SET status = 'cancelled', external_reference = COALESCE(?, external_reference), response_payload = ?, updated_at = NOW()
             WHERE source_type = 'order' AND source_reference_id = ?`,
            [paymentId, JSON.stringify({ reason }), orderId],
          )
          await conn.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [orderId])
        }

        const responseBody = { ok: true, status: order.status === 'paid' ? 'already_paid' : 'cancelled', orderId }
        if (idempotencyKey) {
          await saveIdempotencyResponse(conn, {
            endpoint: 'pi_cancel',
            key: idempotencyKey,
            orderId,
            paymentId,
            code: 200,
            body: responseBody,
          })
        }

        await conn.commit()
        return responseBody
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
