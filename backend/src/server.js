import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import mysql from '@fastify/mysql'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { healthRoutes } from './routes/health.js'
import { productRoutes } from './routes/products.js'
import { cartRoutes } from './routes/cart.js'
import { orderRoutes } from './routes/orders.js'
import { ppobRoutes } from './routes/ppob.js'
import { userRoutes } from './routes/users.js'
import { digiflazzRoutes } from './routes/digiflazz.js'
import { walletRoutes } from './routes/wallet.js'

const app = Fastify({
  logger: true,
})

await app.register(swagger, {
  openapi: {
    info: {
      title: 'PI Store Marketplace API',
      description: 'Backend API untuk marketplace, PPOB, wallet topup, Digiflazz sync, dan checkout IDR.',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3100}`,
        description: 'Local',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
  },
})

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
})

await app.register(cors, {
  origin: true,
})

await app.register(mysql, {
  promise: true,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pi_marketplace',
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
})

const publicApiPaths = new Set([
  '/api/health',
  '/api/orders/duitku/callback',
  '/api/wallet/topup/duitku/callback',
])

app.addHook('onRoute', (routeOptions) => {
  if (!routeOptions.url.startsWith('/api/')) return
  if (publicApiPaths.has(routeOptions.url)) return
  routeOptions.schema = {
    ...(routeOptions.schema || {}),
    security: [{ ApiKeyAuth: [] }],
  }
})

app.addHook('onRequest', async (request, reply) => {
  const path = String(request.raw.url || '').split('?')[0]
  if (!path.startsWith('/api/')) return
  if (publicApiPaths.has(path)) return

  const expectedApiKey = process.env.API_KEY || ''
  if (!expectedApiKey) {
    return reply.code(500).send({ message: 'Server API key is not configured' })
  }

  const providedApiKey = request.headers['x-api-key']
  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    return reply.code(401).send({ message: 'Unauthorized: invalid x-api-key' })
  }
})

app.get('/', async () => ({
  ok: true,
  service: 'pi-store-backend',
  message: 'Marketplace API is running',
}))

await app.register(healthRoutes, { prefix: '/api/health' })
await app.register(userRoutes, { prefix: '/api/users' })
await app.register(productRoutes, { prefix: '/api/products' })
await app.register(cartRoutes, { prefix: '/api/cart' })
await app.register(orderRoutes, { prefix: '/api/orders' })
await app.register(ppobRoutes, { prefix: '/api/ppob' })
await app.register(digiflazzRoutes, { prefix: '/api/digiflazz' })
await app.register(walletRoutes, { prefix: '/api/wallet' })

const port = Number(process.env.PORT || 3100)
const host = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
