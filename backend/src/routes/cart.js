function toInt(value) {
  return Number(value || 0)
}

async function hasCompletedShippingAddress(app, userId) {
  const [rows] = await app.mysql.query(
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

export async function cartRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Get cart by user',
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
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    user_id: { type: 'integer' },
                    product_id: { type: 'integer' },
                    qty: { type: 'integer' },
                    name: { type: 'string' },
                    price_idr: { type: 'number' },
                    price_pi: { type: 'number' },
                    image_url: { type: ['string', 'null'] },
                    stock: { type: 'integer' },
                  },
                },
              },
              totals: {
                type: 'object',
                properties: {
                  subtotal_idr: { type: 'number' },
                  subtotal_pi: { type: 'number' },
                },
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

    const [items] = await app.mysql.query(
      `SELECT ci.id, ci.user_id, ci.product_id, ci.qty,
              p.name, p.price_idr, p.price_pi, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id DESC`,
      [userId],
    )

    const totals = items.reduce(
      (acc, item) => {
        acc.subtotal_idr += Number(item.price_idr) * item.qty
        acc.subtotal_pi += Number(item.price_pi) * item.qty
        return acc
      },
      { subtotal_idr: 0, subtotal_pi: 0 },
    )

    return { items, totals }
    },
  )

  app.post(
    '/items',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Add product to cart',
        body: {
          type: 'object',
          required: ['userId', 'productId'],
          properties: {
            userId: { type: 'integer' },
            productId: { type: 'integer' },
            qty: { type: 'integer', minimum: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              userId: { type: 'integer' },
              productId: { type: 'integer' },
              qty: { type: 'integer' },
            },
          },
          201: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              userId: { type: 'integer' },
              productId: { type: 'integer' },
              qty: { type: 'integer' },
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
    const productId = toInt(request.body?.productId)
    const qty = Math.max(toInt(request.body?.qty), 1)

    if (!userId || !productId) {
      return reply.code(400).send({ message: 'userId and productId are required' })
    }

    const hasAddress = await hasCompletedShippingAddress(app, userId)
    if (!hasAddress) {
      return reply.code(400).send({
        message: 'Alamat pengiriman belum diisi. Lengkapi alamat di menu Profile > Settings terlebih dahulu.',
      })
    }

    const [productRows] = await app.mysql.query('SELECT id, stock FROM products WHERE id = ? AND is_active = 1', [productId])
    if (!productRows.length) {
      return reply.code(404).send({ message: 'Product not found' })
    }

    const [existingRows] = await app.mysql.query('SELECT id, qty FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId])

    if (existingRows.length) {
      const nextQty = existingRows[0].qty + qty
      if (nextQty > productRows[0].stock) {
        return reply.code(400).send({ message: 'Stock is not enough' })
      }
      await app.mysql.query('UPDATE cart_items SET qty = ? WHERE id = ?', [nextQty, existingRows[0].id])
      return { id: existingRows[0].id, userId, productId, qty: nextQty }
    }

    if (qty > productRows[0].stock) {
      return reply.code(400).send({ message: 'Stock is not enough' })
    }

    const [result] = await app.mysql.query(
      'INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)',
      [userId, productId, qty],
    )

    return reply.code(201).send({
      id: result.insertId,
      userId,
      productId,
      qty,
    })
    },
  )

  app.patch(
    '/items/:itemId',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Update cart item quantity',
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'integer' },
          },
        },
        body: {
          type: 'object',
          required: ['userId', 'qty'],
          properties: {
            userId: { type: 'integer' },
            qty: { type: 'integer', minimum: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              qty: { type: 'integer' },
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
    const itemId = toInt(request.params.itemId)
    const userId = toInt(request.body?.userId)
    const qty = Math.max(toInt(request.body?.qty), 1)

    if (!itemId || !userId) {
      return reply.code(400).send({ message: 'itemId and userId are required' })
    }

    const [rows] = await app.mysql.query(
      `SELECT ci.id, ci.product_id, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.id = ? AND ci.user_id = ?`,
      [itemId, userId],
    )

    if (!rows.length) {
      return reply.code(404).send({ message: 'Cart item not found' })
    }

    if (qty > rows[0].stock) {
      return reply.code(400).send({ message: 'Stock is not enough' })
    }

    await app.mysql.query('UPDATE cart_items SET qty = ? WHERE id = ?', [qty, itemId])
    return { id: itemId, qty }
    },
  )

  app.delete(
    '/items/:itemId',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Delete cart item',
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'integer' },
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
              ok: { type: 'boolean' },
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
    const itemId = toInt(request.params.itemId)
    const userId = toInt(request.query.userId)
    if (!itemId || !userId) {
      return reply.code(400).send({ message: 'itemId and userId are required' })
    }

    const [result] = await app.mysql.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [itemId, userId])
    if (!result.affectedRows) {
      return reply.code(404).send({ message: 'Cart item not found' })
    }

    return { ok: true }
    },
  )
}
