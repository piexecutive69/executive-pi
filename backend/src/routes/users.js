export async function userRoutes(app) {
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
              idr_balance: { type: 'number' },
              pi_balance: { type: 'number' },
              status: { type: 'string' },
              created_at: { type: 'string' },
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
        `SELECT id, name, email, phone, idr_balance, pi_balance, status, created_at
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

      const [rows] = await app.mysql.query(
        `SELECT id, name, email, phone, idr_balance, pi_balance, status, created_at
         FROM users
         WHERE id = ?`,
        [userId],
      )

      if (!rows.length) {
        return reply.code(404).send({ message: 'User not found' })
      }

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
        idr_balance: 0,
        pi_balance: 0,
        status: 'active',
      })
    },
  )
}
