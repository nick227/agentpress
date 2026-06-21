import { PromptService } from '../services/PromptService'

const svc = new PromptService()

export async function listPrompts(request: any, reply: any) {
  const { kind, category, search } = request.query ?? {}
  const data = await svc.list(request.auth, { kind, category, search })
  return reply.send({ data })
}

export async function getPrompt(request: any, reply: any) {
  const data = await svc.get(request.auth, request.params.promptId)
  if (!data) return reply.status(404).send({ error: 'Prompt not found' })
  return reply.send({ data })
}

export async function createPrompt(request: any, reply: any) {
  const data = await svc.create(request.auth, request.body)
  return reply.status(201).send({ data })
}

export async function updatePrompt(request: any, reply: any) {
  const data = await svc.update(request.auth, request.params.promptId, request.body)
  return reply.send({ data })
}

export async function deletePrompt(request: any, reply: any) {
  await svc.delete(request.auth, request.params.promptId)
  return reply.send({ ok: true })
}
