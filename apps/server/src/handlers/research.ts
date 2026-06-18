import type { FastifyRequest, FastifyReply } from 'fastify'
import { ResearchService } from '../services/ResearchService'

const svc = new ResearchService()

export async function listResearchSources(request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.list(request.params.accountId) })
}

export async function createResearchSource(
  request: FastifyRequest<{ Params: { accountId: string }; Body: { name: string; category?: string; sourceType?: string; sourceUrl: string } }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.create(request.params.accountId, request.body) })
}

export async function getResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.get(request.params.sourceId) })
}

export async function updateResearchSource(
  request: FastifyRequest<{ Params: { sourceId: string }; Body: { name?: string; category?: string; sourceUrl?: string; status?: string } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.update(request.params.sourceId, request.body) })
}

export async function deleteResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  await svc.delete(request.params.sourceId)
  return reply.send({ ok: true })
}

export async function checkResearchSource(request: FastifyRequest<{ Params: { sourceId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.checkLatest(request.params.sourceId) })
}

export async function listResearchItems(
  request: FastifyRequest<{ Params: { sourceId: string }; Querystring: { page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '15', 10) || 15))
  return reply.send(await svc.listItems(request.params.sourceId, page, limit))
}

export async function getResearchItem(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.getItem(request.params.itemId) })
}

export async function listResearchSummaries(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) {
  return reply.send({ data: await svc.listSummaries(request.params.itemId) })
}

export async function summarizeResearchItem(
  request: FastifyRequest<{ Params: { itemId: string }; Body: { promptId: string } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.summarize(request.params.itemId, request.body.promptId) })
}
