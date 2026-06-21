import { AgentService } from '../services/AgentService'

const service = new AgentService()

export async function listAgents(request: any, reply: any) {
  return reply.send({ data: await service.list(request.auth, request.query) })
}

export async function getAgent(request: any, reply: any) {
  const data = await service.get(request.auth, request.params.agentId)
  if (!data) return reply.status(404).send({ error: 'Agent not found' })
  return reply.send({ data })
}

export async function createAgent(request: any, reply: any) {
  return reply.status(201).send({ data: await service.create(request.auth, request.body) })
}

export async function updateAgent(request: any, reply: any) {
  return reply.send({ data: await service.update(request.auth, request.params.agentId, request.body) })
}

export async function deleteAgent(request: any, reply: any) {
  await service.delete(request.auth, request.params.agentId)
  return reply.send({ ok: true })
}

export async function forkCommunityAgent(request: any, reply: any) {
  return reply.status(201).send({ data: await service.fork(request.auth, request.params.agentId) })
}
