import { CommunityService } from '../services/CommunityService'

const service = new CommunityService()

export async function listCommunityPipelines(_request: any, reply: any) {
  return reply.send({ data: await service.listPipelines() })
}

export async function listCommunityFeeds(_request: any, reply: any) {
  return reply.send({ data: await service.listFeeds() })
}

export async function getCommunityPipeline(request: any, reply: any) {
  return reply.send({ data: await service.getPipeline(request.params.pipelineId) })
}

export async function getCommunityFeed(request: any, reply: any) {
  return reply.send({ data: await service.getFeed(request.params.sourceId) })
}

export async function forkCommunityPipeline(request: any, reply: any) {
  return reply.status(201).send({ data: await service.forkPipeline(request.auth, request.params.pipelineId, request.body?.name) })
}

export async function subscribeCommunityFeed(request: any, reply: any) {
  return reply.status(201).send({ data: await service.subscribeFeed(request.auth, request.params.sourceId) })
}
