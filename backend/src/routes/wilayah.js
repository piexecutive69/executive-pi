export async function wilayahRoutes(app) {
  app.get(
    '/provinces',
    {
      schema: {
        tags: ['Wilayah'],
        summary: 'List provinces',
      },
    },
    async () => {
      const [rows] = await app.mysql.query('SELECT id, name FROM indonesia_provinces ORDER BY name ASC')
      return rows
    },
  )

  app.get(
    '/regencies',
    {
      schema: {
        tags: ['Wilayah'],
        summary: 'List regencies by province',
        querystring: {
          type: 'object',
          required: ['provinceId'],
          properties: {
            provinceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const provinceId = String(request.query?.provinceId || '').trim()
      if (!provinceId) return reply.code(400).send({ message: 'provinceId is required' })

      const [rows] = await app.mysql.query(
        'SELECT id, province_id AS provinceId, name FROM indonesia_regencies WHERE province_id = ? ORDER BY name ASC',
        [provinceId],
      )
      return rows
    },
  )

  app.get(
    '/districts',
    {
      schema: {
        tags: ['Wilayah'],
        summary: 'List districts by regency',
        querystring: {
          type: 'object',
          required: ['regencyId'],
          properties: {
            regencyId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const regencyId = String(request.query?.regencyId || '').trim()
      if (!regencyId) return reply.code(400).send({ message: 'regencyId is required' })

      const [rows] = await app.mysql.query(
        'SELECT id, regency_id AS regencyId, name FROM indonesia_districts WHERE regency_id = ? ORDER BY name ASC',
        [regencyId],
      )
      return rows
    },
  )

  app.get(
    '/villages',
    {
      schema: {
        tags: ['Wilayah'],
        summary: 'List villages by district',
        querystring: {
          type: 'object',
          required: ['districtId'],
          properties: {
            districtId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const districtId = String(request.query?.districtId || '').trim()
      if (!districtId) return reply.code(400).send({ message: 'districtId is required' })

      const [rows] = await app.mysql.query(
        'SELECT id, district_id AS districtId, name, postal_code AS postalCode FROM indonesia_villages WHERE district_id = ? ORDER BY name ASC',
        [districtId],
      )
      return rows
    },
  )
}

