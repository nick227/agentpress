import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import openapiGlue from 'fastify-openapi-glue'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as handlers from './handlers'
import * as security from './plugins/security'

const server = Fastify({ logger: true })

const specPath = resolve(__dirname, '../../../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as object

async function main() {
  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) { cb(null, true); return }
      const allowed = /^http:\/\/(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
      cb(null, allowed)
    },
    credentials: true,
  })

  await server.register(cookie)

  await server.register(swagger, { openapi: spec })
  await server.register(swaggerUi, { routePrefix: '/docs' })

  server.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation })
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message })
    }
    if ((error as any).code === 'P2025') {
      return reply.status(404).send({ error: 'Not found' })
    }
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'Already exists' })
    }
    server.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  await server.register(openapiGlue, {
    specification: specPath,
    service: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)

  server.get('/health', async () => ({ status: 'ok' }))

  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
