import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import openapiGlue from 'fastify-openapi-glue'
import { load } from 'js-yaml'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import * as handlers from './handlers'
import * as security from './plugins/security'
import { SchedulePoller } from './services/SchedulePoller'

const server = Fastify({ logger: true })
const schedulePoller = new SchedulePoller()

const specPath = resolve(__dirname, '../../../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as object

async function main() {
  const corsAllowList = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) { cb(null, true); return }
      if (corsAllowList.length > 0 && corsAllowList.includes(origin)) { cb(null, true); return }
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
      cb(null, isLocal)
    },
    credentials: true,
  })

  await server.register(cookie)

  server.addContentTypeParser(
    ['image/png', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  )

  await server.register(swagger, { openapi: spec })
  await server.register(swaggerUi, { routePrefix: '/docs' })

  server.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation })
    }
    if (error.statusCode) {
      const typedError = error as typeof error & {
        code?: string
        retryable?: boolean
        retryAfterSeconds?: number
      }
      if (typedError.retryAfterSeconds) {
        reply.header('Retry-After', String(typedError.retryAfterSeconds))
      }
      return reply.status(error.statusCode).send({
        error: error.message,
        ...(typedError.code ? { code: typedError.code } : {}),
        ...(typedError.retryable !== undefined ? { retryable: typedError.retryable } : {}),
        ...(typedError.retryAfterSeconds ? { retryAfterSeconds: typedError.retryAfterSeconds } : {}),
      })
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
    serviceHandlers: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)

  server.get('/health', async () => ({ status: 'ok' }))

  const webDistPath = resolve(__dirname, '../../web/dist')
  if (existsSync(webDistPath)) {
    await server.register(fastifyStatic, { root: webDistPath, prefix: '/', wildcard: false })
    server.setNotFoundHandler((_req, reply) => reply.sendFile('index.html'))
  }

  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  })
  schedulePoller.start()
}

server.addHook('onClose', async () => {
  schedulePoller.stop()
})

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
