import { CommunityService } from '../services/CommunityService'

const service = new CommunityService()

export async function listCommunityAgents(request: any, reply: any) {
  return reply.send({ data: await service.listAgents(request.auth?.workspaceId) })
}

export async function listCommunityPipelines(request: any, reply: any) {
  return reply.send({ data: await service.listPipelines(request.auth?.workspaceId) })
}

export async function listCommunityFeeds(request: any, reply: any) {
  return reply.send({ data: await service.listFeeds(request.auth?.workspaceId) })
}

export async function listCommunityPrompts(request: any, reply: any) {
  return reply.send({ data: await service.listPrompts(request.auth?.workspaceId) })
}

export async function getCommunityPipeline(request: any, reply: any) {
  return reply.send({ data: await service.getPipeline(request.params.pipelineId) })
}

export async function getCommunityFeed(request: any, reply: any) {
  return reply.send({ data: await service.getFeed(request.params.sourceId) })
}

export async function getCommunityPrompt(request: any, reply: any) {
  return reply.send({ data: await service.getPrompt(request.params.promptId) })
}

export async function forkCommunityPipeline(request: any, reply: any) {
  return reply.status(201).send({ data: await service.forkPipeline(request.auth, request.params.pipelineId, request.body?.name) })
}

export async function forkCommunityFeed(request: any, reply: any) {
  return reply.status(201).send({ data: await service.forkFeed(request.auth, request.params.sourceId) })
}

export async function forkCommunityPrompt(request: any, reply: any) {
  return reply.status(201).send({ data: await service.forkPrompt(request.auth, request.params.promptId) })
}
