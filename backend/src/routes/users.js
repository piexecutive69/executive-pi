import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

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

      return rows[0]
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
          },
        },
      },
    },
    async (request, reply) => {
      const { name, email, phone, password } = request.body || {}
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

      return reply.code(201).send({
        id: result.insertId,
        name,
        email,
        phone,
        profile_image_url: null,
        idr_balance: 0,
        pi_balance: 0,
        status: 'active',
      })
    },
  )
}
