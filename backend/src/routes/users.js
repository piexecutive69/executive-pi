import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { resolvePiContextFromRequest } from '../lib/piContext.js'

export async function userRoutes(app) {
  async function getUserById(userId) {
    const [rows] = await app.mysql.query(
      `SELECT id, name, email, phone, profile_image_url, idr_balance, pi_balance, status, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    )
    return rows[0] || null
  }

  function toNullableString(value) {
    if (value === undefined || value === null) return null
    const parsed = String(value).trim()
    return parsed || null
  }

  function makePiIdentity(uid) {
    const safeUid = String(uid || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const shortUid = safeUid.slice(0, 28) || randomUUID().replace(/-/g, '').slice(0, 16)
    return {
      email: `pi_${shortUid}@pi.local`,
      phone: `pi${shortUid}`.slice(0, 40),
      shortUid,
    }
  }

  async function fetchPiMe(accessToken) {
    const token = toNullableString(accessToken)
    if (!token) return null
    try {
      const meRes = await fetch('https://api.minepi.com/v2/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!meRes.ok) return null
      return await meRes.json().catch(() => null)
    } catch {
      return null
    }
  }

  async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return null
      return await res.json().catch(() => null)
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async function fetchPiOnChainBalance(walletAddress, preferredNetwork = 'mainnet') {
    const address = toNullableString(walletAddress)
    if (!address) return null

    const network = String(preferredNetwork || process.env.PI_CHAIN_NETWORK || 'mainnet').trim().toLowerCase()
    const primaryHosts =
      network === 'testnet'
        ? ['https://api.testnet.minepi.com', 'https://api.testnet.minepi.com/horizon']
        : ['https://api.mainnet.minepi.com', 'https://api.mainnet.minepi.com/horizon']
    const fallbackHosts =
      network === 'testnet'
        ? ['https://api.mainnet.minepi.com', 'https://api.mainnet.minepi.com/horizon']
        : ['https://api.testnet.minepi.com', 'https://api.testnet.minepi.com/horizon']
    const hosts = [...primaryHosts, ...fallbackHosts]

    for (const host of hosts) {
      const account = await fetchJsonWithTimeout(`${host}/accounts/${encodeURIComponent(address)}`)
      const balances = Array.isArray(account?.balances) ? account.balances : []
      const native = balances.find((item) => String(item?.asset_type || '').toLowerCase() === 'native')
      const candidate = native?.balance ?? account?.balance ?? null
      const parsed = Number(candidate)
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed
      }
    }

    return null
  }

  await app.mysql.query(
    `CREATE TABLE IF NOT EXISTS user_pi_wallets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      pi_uid VARCHAR(120) NOT NULL,
      pi_username VARCHAR(120) NULL,
      wallet_address VARCHAR(255) NULL,
      wallet_secret_id VARCHAR(190) NULL,
      last_pi_balance DECIMAL(18,8) NOT NULL DEFAULT 0,
      last_synced_at TIMESTAMP NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_pi_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_pi_wallet_user (user_id),
      UNIQUE KEY uq_user_pi_wallet_uid (pi_uid)
    )`,
  )

  async function syncPiWalletForUser({ userId, piAuthPayload = {}, fallbackName = null, piNetwork = 'mainnet' }) {
    const inputUid = toNullableString(piAuthPayload?.uid)
    const inputUsername = toNullableString(piAuthPayload?.username)
    const accessToken = toNullableString(piAuthPayload?.accessToken)
    const inputWalletAddress = toNullableString(piAuthPayload?.walletAddress)
    const inputWalletSecretId = toNullableString(piAuthPayload?.walletSecretId)
    const hasInputPiBalance = piAuthPayload?.piBalance !== undefined && piAuthPayload?.piBalance !== null
    const inputPiBalance = hasInputPiBalance ? Number(piAuthPayload?.piBalance) : null

    if (!inputUid && !accessToken) return null

    const [existingRows] = await app.mysql.query(
      `SELECT pi_uid, pi_username, wallet_address, wallet_secret_id, last_pi_balance
       FROM user_pi_wallets
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    )
    const existing = existingRows[0] || null

    const piMe = await fetchPiMe(accessToken)
    const finalUid = inputUid || toNullableString(piMe?.uid) || toNullableString(existing?.pi_uid)
    if (!finalUid) return null

    const finalUsername =
      inputUsername ||
      toNullableString(piMe?.username) ||
      toNullableString(existing?.pi_username) ||
      fallbackName ||
      null
    const finalWalletAddress =
      inputWalletAddress ||
      toNullableString(piMe?.wallet_address) ||
      toNullableString(piMe?.walletAddress) ||
      toNullableString(existing?.wallet_address)
    const finalWalletSecretId =
      inputWalletSecretId ||
      toNullableString(existing?.wallet_secret_id) ||
      `pi_uid:${finalUid}`
    const onChainPiBalance = finalWalletAddress ? await fetchPiOnChainBalance(finalWalletAddress, piNetwork) : null
    const finalPiBalanceRaw =
      onChainPiBalance ??
      piMe?.balance ??
      piMe?.pi_balance ??
      piMe?.piBalance ??
      (hasInputPiBalance ? inputPiBalance : existing?.last_pi_balance)
    const finalPiBalance = Number.isFinite(Number(finalPiBalanceRaw)) ? Math.max(0, Number(finalPiBalanceRaw)) : 0

    await app.mysql.query(
      `INSERT INTO user_pi_wallets
         (user_id, pi_uid, pi_username, wallet_address, wallet_secret_id, last_pi_balance, last_synced_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         pi_uid = VALUES(pi_uid),
         pi_username = VALUES(pi_username),
         wallet_address = VALUES(wallet_address),
         wallet_secret_id = VALUES(wallet_secret_id),
         last_pi_balance = VALUES(last_pi_balance),
         last_synced_at = NOW(),
         metadata_json = VALUES(metadata_json)`,
      [
        userId,
        finalUid,
        finalUsername,
        finalWalletAddress,
        finalWalletSecretId,
        finalPiBalance,
        JSON.stringify({
          piMe: piMe || null,
          source: {
            uid: inputUid ? 'client' : piMe?.uid ? 'pi_me' : existing?.pi_uid ? 'db' : null,
            walletAddress: inputWalletAddress ? 'client' : piMe?.wallet_address || piMe?.walletAddress ? 'pi_me' : existing?.wallet_address ? 'db' : null,
            piBalance:
              onChainPiBalance !== null
                ? 'pi_chain'
                : piMe?.balance !== undefined || piMe?.pi_balance !== undefined || piMe?.piBalance !== undefined
                  ? 'pi_me'
                  : hasInputPiBalance
                    ? 'client'
                    : existing?.last_pi_balance !== undefined
                      ? 'db'
                      : null,
          },
        }),
      ],
    )

    await app.mysql.query(
      `UPDATE users
       SET pi_balance = ?, updated_at = NOW()
       WHERE id = ?`,
      [finalPiBalance, userId],
    )

    return {
      uid: finalUid,
      username: finalUsername,
      walletAddress: finalWalletAddress,
      walletSecretId: finalWalletSecretId,
      piBalance: finalPiBalance,
    }
  }

  async function getPiWalletByUserId(userId) {
    const [rows] = await app.mysql.query(
      `SELECT pi_uid AS uid,
              pi_username AS username,
              wallet_address AS walletAddress,
              wallet_secret_id AS walletSecretId,
              last_pi_balance AS piBalance,
              last_synced_at AS lastSyncedAt
       FROM user_pi_wallets
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    )
    return rows[0] || null
  }

  app.post(
    '/login',
    {
      schema: {
        tags: ['Users'],
        summary: 'Login by phone and password',
        body: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string' },
            password: { type: 'string' },
            piAuth: {
              type: ['object', 'null'],
              properties: {
                uid: { type: ['string', 'null'] },
                username: { type: ['string', 'null'] },
                accessToken: { type: ['string', 'null'] },
                walletAddress: { type: ['string', 'null'] },
                walletSecretId: { type: ['string', 'null'] },
                piBalance: { type: ['number', 'null'] },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: ['string', 'null'] },
              profile_image_url: { type: ['string', 'null'] },
              idr_balance: { type: 'number' },
              pi_balance: { type: 'number' },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          401: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const piContext = resolvePiContextFromRequest(request)
      const phone = String(request.body?.phone || '').trim()
      const password = String(request.body?.password || '')
      if (!phone || !password) {
        return reply.code(400).send({ message: 'phone and password are required' })
      }

      const [rows] = await app.mysql.query(
        `SELECT id, name, email, phone, profile_image_url, idr_balance, pi_balance, status, created_at, updated_at
         FROM users
         WHERE phone = ? AND password_hash = SHA2(?, 256)
         LIMIT 1`,
        [phone, password],
      )

      if (!rows.length) {
        return reply.code(401).send({ message: 'Invalid phone or password' })
      }

      const user = rows[0]
      const piAuthPayload = request.body?.piAuth || null
      if (piAuthPayload && (piAuthPayload.uid || piAuthPayload.accessToken)) {
        const synced = await syncPiWalletForUser({
          userId: Number(user.id),
          piAuthPayload,
          fallbackName: user.name,
          piNetwork: piContext.network,
        })
        const refreshed = await getUserById(Number(user.id))
        return {
          ...refreshed,
          pi_auth: synced,
        }
      }

      const existingPi = await getPiWalletByUserId(Number(user.id))
      return {
        ...user,
        pi_auth: existingPi,
      }
    },
  )

  app.post(
    '/pi-auth',
    {
      schema: {
        tags: ['Users'],
        summary: 'Login/register via Pi SDK identity',
        body: {
          type: 'object',
          required: ['uid'],
          properties: {
            uid: { type: 'string' },
            username: { type: ['string', 'null'] },
            accessToken: { type: ['string', 'null'] },
            walletAddress: { type: ['string', 'null'] },
            piBalance: { type: ['number', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const piContext = resolvePiContextFromRequest(request)
      const uid = String(request.body?.uid || '').trim()
      const username = toNullableString(request.body?.username)
      const accessToken = toNullableString(request.body?.accessToken)
      const walletAddressInput = toNullableString(request.body?.walletAddress)

      if (!uid) {
        return reply.code(400).send({ message: 'uid is required' })
      }

      const piMe = await fetchPiMe(accessToken)

      const { email, phone, shortUid } = makePiIdentity(uid)
      const fallbackName = `Pi User ${shortUid}`
      const nextName = username || toNullableString(piMe?.username) || fallbackName
      const incomingPiBalance = Number(
        request.body?.piBalance ??
          piMe?.balance ??
          piMe?.pi_balance ??
          piMe?.piBalance ??
          0,
      )
      const normalizedPiBalance = Number.isFinite(incomingPiBalance) ? Math.max(0, incomingPiBalance) : 0
      const walletAddress =
        walletAddressInput ||
        toNullableString(piMe?.wallet_address) ||
        toNullableString(piMe?.walletAddress)
      const walletSecretId = toNullableString(request.body?.walletSecretId)

      const [rows] = await app.mysql.query(
        `SELECT id
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [email],
      )

      let userId = null
      if (rows.length) {
        userId = Number(rows[0].id)
        await app.mysql.query(
          `UPDATE users
           SET name = ?, pi_balance = GREATEST(pi_balance, ?), updated_at = NOW()
           WHERE id = ?`,
          [nextName, normalizedPiBalance, userId],
        )
      } else {
        const seedPassword = randomUUID()
        const [insertRes] = await app.mysql.query(
          `INSERT INTO users (name, email, phone, password_hash, idr_balance, pi_balance, status)
           VALUES (?, ?, ?, SHA2(?, 256), 0, ?, 'active')`,
          [nextName, email, phone, seedPassword, normalizedPiBalance],
        )
        userId = Number(insertRes.insertId)
      }

      const syncedWallet = await syncPiWalletForUser({
        userId,
        piAuthPayload: {
          uid,
          username: nextName,
          accessToken,
          walletAddress,
          walletSecretId,
          piBalance: normalizedPiBalance,
        },
        fallbackName: nextName,
        piNetwork: piContext.network,
      })
      const user = await getUserById(userId)
      return {
        ...user,
        pi_auth: syncedWallet || {
          uid,
          username: nextName,
          walletAddress,
          walletSecretId,
          piBalance: normalizedPiBalance,
        },
      }
    },
  )

  app.post(
    '/:id/pi-balance/sync',
    {
      schema: {
        tags: ['Users'],
        summary: 'Sync Pi balance from Pi access token',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
        body: {
          type: 'object',
          required: ['accessToken'],
          properties: {
            accessToken: { type: 'string' },
            uid: { type: ['string', 'null'] },
            username: { type: ['string', 'null'] },
            walletAddress: { type: ['string', 'null'] },
            walletSecretId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const piContext = resolvePiContextFromRequest(request)
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const accessToken = toNullableString(request.body?.accessToken)
      const expectedUid = toNullableString(request.body?.uid)
      const fallbackUsername = toNullableString(request.body?.username)
      const fallbackWalletAddress = toNullableString(request.body?.walletAddress)
      const fallbackWalletSecretId = toNullableString(request.body?.walletSecretId)
      if (!accessToken) {
        return reply.code(400).send({ message: 'accessToken is required' })
      }

      const user = await getUserById(userId)
      if (!user) {
        return reply.code(404).send({ message: 'User not found' })
      }

      const piMe = await fetchPiMe(accessToken)
      if (!piMe) {
        return reply.code(401).send({ message: 'Failed to validate access token with Pi API' })
      }

      const meUid = toNullableString(piMe?.uid)
      if (expectedUid && meUid && expectedUid !== meUid) {
        return reply.code(401).send({ message: 'Pi uid does not match current session' })
      }

      const syncedWallet = await syncPiWalletForUser({
        userId,
        piAuthPayload: {
          uid: expectedUid || meUid,
          username: fallbackUsername || toNullableString(piMe?.username),
          accessToken,
          walletAddress: fallbackWalletAddress,
          walletSecretId: fallbackWalletSecretId,
          piBalance: Number(piMe?.balance ?? piMe?.pi_balance ?? piMe?.piBalance ?? user.pi_balance ?? 0),
        },
        fallbackName: user.name,
        piNetwork: piContext.network,
      })
      const refreshed = await getUserById(userId)
      return {
        ...refreshed,
        pi_auth: syncedWallet,
      }
    },
  )

  app.get(
    '/pi-wallets',
    {
      schema: {
        tags: ['Users'],
        summary: 'Admin list: user Pi wallet link status',
      },
    },
    async (request) => {
      const page = Math.max(Number(request.query?.page || 1), 1)
      const limit = Math.min(Math.max(Number(request.query?.limit || 20), 1), 100)
      const offset = (page - 1) * limit
      const status = String(request.query?.status || 'all').toLowerCase()
      const searchRaw = String(request.query?.search || '').trim()
      const search = searchRaw ? `%${searchRaw}%` : null

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
           u.id,
           u.name,
           u.email,
           u.phone,
           u.status,
           u.pi_balance,
           upw.pi_uid AS piUid,
           upw.pi_username AS piUsername,
           upw.wallet_address AS walletAddress,
           upw.wallet_secret_id AS walletSecretId,
           upw.last_pi_balance AS lastPiBalance,
           upw.last_synced_at AS lastSyncedAt,
           upw.updated_at AS walletUpdatedAt
         FROM users u
         LEFT JOIN user_pi_wallets upw ON upw.user_id = u.id
         ${whereClause}
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )

      const items = rows.map((item) => ({
        ...item,
        isLinked: Boolean(item.piUid),
      }))

      return {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        items,
      }
    },
  )

  app.get(
    '/:id',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get user by id',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const user = await getUserById(userId)
      if (!user) {
        return reply.code(404).send({ message: 'User not found' })
      }

      return user
    },
  )

  app.get(
    '/:id/profile',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get editable profile by user id',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const user = await getUserById(userId)
      if (!user) {
        return reply.code(404).send({ message: 'User not found' })
      }

      return user
    },
  )

  app.patch(
    '/:id/profile',
    {
      schema: {
        tags: ['Users'],
        summary: 'Update editable profile by user id',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const current = await getUserById(userId)
      if (!current) {
        return reply.code(404).send({ message: 'User not found' })
      }

      const payload = request.body || {}
      const nextName = payload.name === undefined ? current.name : String(payload.name || '').trim()
      const nextEmail = payload.email === undefined ? current.email : String(payload.email || '').trim()
      const requestedPhone = payload.phone === undefined ? current.phone : toNullableString(payload.phone)

      if (requestedPhone !== current.phone) {
        return reply.code(400).send({ message: 'phone cannot be changed from profile settings' })
      }

      if (!nextName) {
        return reply.code(400).send({ message: 'name is required' })
      }
      if (!nextEmail) {
        return reply.code(400).send({ message: 'email is required' })
      }

      const [conflicts] = await app.mysql.query('SELECT id FROM users WHERE id <> ? AND email = ? LIMIT 1', [userId, nextEmail])
      if (conflicts.length) {
        return reply.code(409).send({ message: 'Email already registered' })
      }

      await app.mysql.query(
        `UPDATE users
         SET name = ?, email = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextName, nextEmail, userId],
      )

      const user = await getUserById(userId)
      return user
    },
  )

  app.post(
    '/:id/profile-image',
    {
      schema: {
        tags: ['Users'],
        summary: 'Upload profile image',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const current = await getUserById(userId)
      if (!current) {
        return reply.code(404).send({ message: 'User not found' })
      }

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

      const uploadDir = path.resolve(process.cwd(), 'uploads', 'profiles')
      await fs.mkdir(uploadDir, { recursive: true })

      const filename = `u${userId}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
      const destination = path.join(uploadDir, filename)
      await pipeline(upload.file, createWriteStream(destination))

      const nextImageUrl = `/uploads/profiles/${filename}`
      await app.mysql.query(
        `UPDATE users
         SET profile_image_url = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextImageUrl, userId],
      )

      const oldImageUrl = String(current.profile_image_url || '')
      if (oldImageUrl.startsWith('/uploads/profiles/')) {
        const oldFilename = path.basename(oldImageUrl)
        const oldPath = path.join(uploadDir, oldFilename)
        if (oldFilename && oldFilename !== filename) {
          await fs.unlink(oldPath).catch(() => {})
        }
      }

      const user = await getUserById(userId)
      return user
    },
  )

  app.patch(
    '/:id/password',
    {
      schema: {
        tags: ['Users'],
        summary: 'Update user password',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: { type: 'string', minLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const newPassword = String(request.body?.newPassword || '')
      if (!newPassword) {
        return reply.code(400).send({ message: 'newPassword is required' })
      }
      if (newPassword.length < 6) {
        return reply.code(400).send({ message: 'newPassword must be at least 6 characters' })
      }

      await app.mysql.query(
        `UPDATE users
         SET password_hash = SHA2(?, 256), updated_at = NOW()
         WHERE id = ?`,
        [newPassword, userId],
      )

      return { ok: true, message: 'Password updated successfully' }
    },
  )

  app.get(
    '/:id/address',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get user address',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const user = await getUserById(userId)
      if (!user) {
        return reply.code(404).send({ message: 'User not found' })
      }

      const [rows] = await app.mysql.query(
        `SELECT
           ua.user_id AS userId,
           ua.address_line AS addressLine,
           ua.province_id AS provinceId,
           ua.regency_id AS regencyId,
           ua.district_id AS districtId,
           ua.village_id AS villageId,
           ua.postal_code AS postalCode,
           p.name AS provinceName,
           r.name AS regencyName,
           d.name AS districtName,
           v.name AS villageName
         FROM user_addresses ua
         LEFT JOIN indonesia_provinces p ON p.id = ua.province_id
         LEFT JOIN indonesia_regencies r ON r.id = ua.regency_id
         LEFT JOIN indonesia_districts d ON d.id = ua.district_id
         LEFT JOIN indonesia_villages v ON v.id = ua.village_id
         WHERE ua.user_id = ?
         LIMIT 1`,
        [userId],
      )

      if (!rows.length) {
        return {
          userId,
          addressLine: null,
          provinceId: null,
          regencyId: null,
          districtId: null,
          villageId: null,
          postalCode: null,
          provinceName: null,
          regencyName: null,
          districtName: null,
          villageName: null,
        }
      }

      return rows[0]
    },
  )

  app.put(
    '/:id/address',
    {
      schema: {
        tags: ['Users'],
        summary: 'Create or update user address',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
        body: {
          type: 'object',
          properties: {
            addressLine: { type: ['string', 'null'] },
            provinceId: { type: ['string', 'null'] },
            regencyId: { type: ['string', 'null'] },
            districtId: { type: ['string', 'null'] },
            villageId: { type: ['string', 'null'] },
            postalCode: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = Number(request.params.id)
      if (!userId) {
        return reply.code(400).send({ message: 'Invalid user id' })
      }

      const user = await getUserById(userId)
      if (!user) {
        return reply.code(404).send({ message: 'User not found' })
      }

      const body = request.body || {}
      const addressLine = toNullableString(body.addressLine)
      const provinceId = toNullableString(body.provinceId)
      const regencyId = toNullableString(body.regencyId)
      const districtId = toNullableString(body.districtId)
      const villageId = toNullableString(body.villageId)
      const postalCodeInput = toNullableString(body.postalCode)

      if (regencyId && !provinceId) {
        return reply.code(400).send({ message: 'provinceId is required when regencyId is provided' })
      }
      if (districtId && !regencyId) {
        return reply.code(400).send({ message: 'regencyId is required when districtId is provided' })
      }
      if (villageId && !districtId) {
        return reply.code(400).send({ message: 'districtId is required when villageId is provided' })
      }

      if (provinceId) {
        const [rows] = await app.mysql.query('SELECT id FROM indonesia_provinces WHERE id = ? LIMIT 1', [provinceId])
        if (!rows.length) return reply.code(400).send({ message: 'Invalid provinceId' })
      }

      if (regencyId) {
        const [rows] = await app.mysql.query(
          'SELECT id FROM indonesia_regencies WHERE id = ? AND province_id = ? LIMIT 1',
          [regencyId, provinceId],
        )
        if (!rows.length) return reply.code(400).send({ message: 'Invalid regencyId for selected province' })
      }

      if (districtId) {
        const [rows] = await app.mysql.query(
          'SELECT id FROM indonesia_districts WHERE id = ? AND regency_id = ? LIMIT 1',
          [districtId, regencyId],
        )
        if (!rows.length) return reply.code(400).send({ message: 'Invalid districtId for selected regency' })
      }

      let postalCode = postalCodeInput
      if (villageId) {
        const [rows] = await app.mysql.query(
          'SELECT id, postal_code AS postalCode FROM indonesia_villages WHERE id = ? AND district_id = ? LIMIT 1',
          [villageId, districtId],
        )
        if (!rows.length) return reply.code(400).send({ message: 'Invalid villageId for selected district' })
        if (!postalCode) postalCode = toNullableString(rows[0].postalCode)
      }

      await app.mysql.query(
        `INSERT INTO user_addresses
           (user_id, address_line, province_id, regency_id, district_id, village_id, postal_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           address_line = VALUES(address_line),
           province_id = VALUES(province_id),
           regency_id = VALUES(regency_id),
           district_id = VALUES(district_id),
           village_id = VALUES(village_id),
           postal_code = VALUES(postal_code),
           updated_at = NOW()`,
        [userId, addressLine, provinceId, regencyId, districtId, villageId, postalCode],
      )

      const [rows] = await app.mysql.query(
        `SELECT
           ua.user_id AS userId,
           ua.address_line AS addressLine,
           ua.province_id AS provinceId,
           ua.regency_id AS regencyId,
           ua.district_id AS districtId,
           ua.village_id AS villageId,
           ua.postal_code AS postalCode,
           p.name AS provinceName,
           r.name AS regencyName,
           d.name AS districtName,
           v.name AS villageName
         FROM user_addresses ua
         LEFT JOIN indonesia_provinces p ON p.id = ua.province_id
         LEFT JOIN indonesia_regencies r ON r.id = ua.regency_id
         LEFT JOIN indonesia_districts d ON d.id = ua.district_id
         LEFT JOIN indonesia_villages v ON v.id = ua.village_id
         WHERE ua.user_id = ?
         LIMIT 1`,
        [userId],
      )

      return rows[0]
    },
  )

  app.post(
    '/',
    {
      schema: {
        tags: ['Users'],
        summary: 'Create new user',
        body: {
          type: 'object',
          required: ['name', 'email', 'phone', 'password'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 6 },
            piAuth: {
              type: ['object', 'null'],
              properties: {
                uid: { type: ['string', 'null'] },
                username: { type: ['string', 'null'] },
                accessToken: { type: ['string', 'null'] },
                walletAddress: { type: ['string', 'null'] },
                walletSecretId: { type: ['string', 'null'] },
                piBalance: { type: ['number', 'null'] },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, email, phone, password, piAuth } = request.body || {}
      if (!name || !email || !phone || !password) {
        return reply.code(400).send({ message: 'name, email, phone, password are required' })
      }

      const [existing] = await app.mysql.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone])
      if (existing.length) {
        return reply.code(409).send({ message: 'Email or phone already registered' })
      }

      const [result] = await app.mysql.query(
        `INSERT INTO users (name, email, phone, password_hash, idr_balance, pi_balance, status)
         VALUES (?, ?, ?, SHA2(?, 256), 0, 0, 'active')`,
        [name, email, phone, password],
      )

      const piWallet = piAuth
        ? await syncPiWalletForUser({
            userId: Number(result.insertId),
            piAuthPayload: piAuth,
            fallbackName: String(name),
          })
        : null

      const createdUser = await getUserById(Number(result.insertId))

      return reply.code(201).send({
        ...createdUser,
        pi_auth: piWallet,
      })
    },
  )
}
