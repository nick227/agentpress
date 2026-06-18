import { LibraryAgentService } from '../services/LibraryAgentService'

const svc = new LibraryAgentService()

export async function listLibraryAgents(request: any, reply: any) {
  const { category, search } = request.query ?? {}
  const agents = await svc.list(category, search)
  return reply.send({ data: agents })
}

export async function getLibraryAgent(request: any, reply: any) {
  const agent = await svc.get(request.params.agentId)
  if (!agent) return reply.status(404).send({ error: 'Agent not found' })
  return reply.send({ data: agent })
}

export async function createLibraryAgent(request: any, reply: any) {
  const agent = await svc.create(request.body)
  return reply.status(201).send({ data: agent })
}

export async function updateLibraryAgent(request: any, reply: any) {
  const agent = await svc.update(request.params.agentId, request.body)
  return reply.send({ data: agent })
}

export async function deleteLibraryAgent(request: any, reply: any) {
  await svc.delete(request.params.agentId)
  return reply.send({ ok: true })
}
