import type { FastifyRequest, FastifyReply } from 'fastify'
import { SummaryPromptService } from '../services/SummaryPromptService'

const svc = new SummaryPromptService()

export async function listSummaryPrompts(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({ data: await svc.list() })
}

export async function createSummaryPrompt(
  request: FastifyRequest<{
    Body: { name: string; description?: string; systemPrompt: string; userPrompt: string; isDefault?: boolean; sortOrder?: number }
  }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.create(request.body) })
}

export async function updateSummaryPrompt(
  request: FastifyRequest<{
    Params: { promptId: string }
    Body: { name?: string; description?: string; systemPrompt?: string; userPrompt?: string; isDefault?: boolean; sortOrder?: number }
  }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.update(request.params.promptId, request.body) })
}

export async function deleteSummaryPrompt(
  request: FastifyRequest<{ Params: { promptId: string } }>,
  reply: FastifyReply,
) {
  await svc.delete(request.params.promptId)
  return reply.send({ ok: true })
}
