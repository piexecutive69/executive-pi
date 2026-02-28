export async function productRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Products'],
        summary: 'List products',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            search: { type: 'string' },
            categoryId: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    price_idr: { type: 'number' },
                    price_pi: { type: 'number' },
                    stock: { type: 'integer' },
                    rating: { type: 'number' },
                    image_url: { type: ['string', 'null'] },
                    category_id: { type: 'integer' },
                    category_name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
    const page = Math.max(Number(request.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(request.query.limit || 12), 1), 100)
    const offset = (page - 1) * limit
    const search = request.query.search ? `%${request.query.search}%` : null
    const categoryId = Number(request.query.categoryId || 0) || null

    const conditions = ['p.is_active = 1']
    const params = []

    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)')
      params.push(search, search)
    }

    if (categoryId) {
      conditions.push('p.category_id = ?')
      params.push(categoryId)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const [items] = await app.mysql.query(
      `SELECT p.id, p.slug, p.name, p.description, p.price_idr, p.price_pi, p.stock, p.rating, p.image_url,
              c.id AS category_id, c.name AS category_name
       FROM products p
       JOIN product_categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    const [countRows] = await app.mysql.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, params)

    return {
      page,
      limit,
      total: countRows[0].total,
      items,
    }
    },
  )

  app.get(
    '/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by id',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              slug: { type: 'string' },
              name: { type: 'string' },
              description: { type: ['string', 'null'] },
              price_idr: { type: 'number' },
              price_pi: { type: 'number' },
              stock: { type: 'integer' },
              rating: { type: 'number' },
              image_url: { type: ['string', 'null'] },
              category_id: { type: 'integer' },
              category_name: { type: 'string' },
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
    const id = Number(request.params.id)
    if (!id) {
      return reply.code(400).send({ message: 'Invalid product id' })
    }

    const [rows] = await app.mysql.query(
      `SELECT p.id, p.slug, p.name, p.description, p.price_idr, p.price_pi, p.stock, p.rating, p.image_url,
              c.id AS category_id, c.name AS category_name
       FROM products p
       JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.is_active = 1`,
      [id],
    )

    if (!rows.length) {
      return reply.code(404).send({ message: 'Product not found' })
    }

    return rows[0]
    },
  )
}
