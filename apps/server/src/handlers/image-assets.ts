import type { FastifyReply, FastifyRequest } from 'fastify'
import { ImageAssetService } from '../services/ImageAssetService'
import { mimeTypeForAsset, OutputAssetService } from '../services/OutputAssetService'

const svc = new ImageAssetService()
const assets = new OutputAssetService()

export async function listImageAssets(
  request: FastifyRequest<{ Params: { pipelineId: string }; Querystring: { agentId?: string } }>,
  reply: FastifyReply,
) {
  return reply.send({ data: await svc.list(request.params.pipelineId, request.query.agentId) })
}

export async function generateImageAsset(
  request: FastifyRequest<{ Params: { pipelineId: string }; Body: { agentId: string; prompt: string } }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.generate(request.params.pipelineId, request.body) })
}

export async function uploadImageAsset(
  request: FastifyRequest<{
    Params: { pipelineId: string }
    Body: { agentId: string; dataBase64: string; filename?: string; label?: string }
  }>,
  reply: FastifyReply,
) {
  return reply.status(201).send({ data: await svc.upload(request.params.pipelineId, request.body) })
}

export async function downloadImageAsset(
  request: FastifyRequest<{ Params: { assetId: string } }>,
  reply: FastifyReply,
) {
  const file = await assets.getImageAssetFile(request.params.assetId)
  if (!file) return reply.status(404).send({ error: 'Asset not found' })

  return reply
    .type(mimeTypeForAsset(file.filename))
    .send(file.buffer)
}
