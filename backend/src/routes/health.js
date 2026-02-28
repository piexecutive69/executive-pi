export async function healthRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check API + database',
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              db: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
    const [rows] = await app.mysql.query('SELECT 1 AS ok')
    return {
      ok: true,
      db: rows?.[0]?.ok === 1 ? 'connected' : 'unknown',
      timestamp: new Date().toISOString(),
    }
    },
  )
}
