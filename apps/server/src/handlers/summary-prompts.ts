import type { FastifyRequest, FastifyReply } from 'fastify'
import { SummaryPromptService } from '../services/SummaryPromptService'

const svc = new SummaryPromptService()

export async function listSummaryPrompts(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({ data: await svc.list((request as any).auth) })
}

export async function createSummaryPrompt(
  request: FastifyRequest<{
    Body: { name: string; description?: string; systemPrompt: string; userPrompt: string; isDefault?: boolean; sortOrder?: number }
  }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.create((request as any).auth, request.body) })
}

export async function updateSummaryPrompt(
  request: FastifyRequest<{
    Params: { promptId: string }
    Body: { name?: string; description?: string; systemPrompt?: string; userPrompt?: string; isDefault?: boolean; sortOrder?: number }
  }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.update((request as any).auth, request.params.promptId, request.body) })
}

export async function deleteSummaryPrompt(
  request: FastifyRequest<{ Params: { promptId: string } }>,
  reply: FastifyReply,
) {
  await svc.delete((request as any).auth, request.params.promptId)
  return reply.send({ ok: true })
}
