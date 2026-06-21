import type { FastifyRequest, FastifyReply } from 'fastify'
import { ResearchService } from '../services/ResearchService'

const svc = new ResearchService()

export async function listResearchSources(request: any, reply: FastifyReply) {
  return reply.send({ data: await svc.list(request.auth) })
}

export async function createResearchSource(
  request: FastifyRequest<{ Body: { name: string; category?: string; sourceType?: string; sourceUrl: string; visibility?: 'PRIVATE' | 'PUBLIC' } }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.create((request as any).auth, request.body) })
}

export async function getResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.get((request as any).auth, request.params.sourceId) })
}

export async function updateResearchSource(
  request: FastifyRequest<{ Params: { sourceId: string }; Body: { name?: string; category?: string; sourceUrl?: string; status?: string; visibility?: 'PRIVATE' | 'PUBLIC' } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.update((request as any).auth, request.params.sourceId, request.body) })
}

export async function deleteResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  await svc.delete((request as any).auth, request.params.sourceId)
  return reply.send({ ok: true })
}

export async function checkResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.checkLatest((request as any).auth, request.params.sourceId) })
}

export async function checkResearchSources(
  request: FastifyRequest<{ Body: { category?: string } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.checkMany((request as any).auth, request.body?.category) })
}

export async function listResearchItems(
  request: FastifyRequest<{ Params: { sourceId: string }; Querystring: { page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '15', 10) || 15))
  return reply.send(await svc.listItems((request as any).auth, request.params.sourceId, page, limit))
}

export async function getResearchItem(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.getItem((request as any).auth, request.params.itemId) })
}

export async function listResearchSummaries(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.listSummaries((request as any).auth, request.params.itemId) })
}

export async function summarizeResearchItem(
  request: FastifyRequest<{ Params: { itemId: string }; Body: { promptId: string } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.summarize((request as any).auth, request.params.itemId, request.body.promptId) })
}

export async function refreshResearchItemContent(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) {
  try {
    return reply.send({ data: await svc.refreshItemContent((request as any).auth, request.params.itemId) })
  } catch (err: any) {
    if (err.statusCode === 400) return reply.status(400).send({ error: err.message })
    throw err
  }
}
