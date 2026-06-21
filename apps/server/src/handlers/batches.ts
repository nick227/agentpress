import { PipelineBatchService } from '../services/PipelineBatchService'

const svc = new PipelineBatchService()

export async function getPipelineLoop(request: any, reply: any) {
  const loop = await svc.getLoop(request.auth, request.params.pipelineId)
  return reply.send({ data: loop })
}

export async function upsertPipelineLoop(request: any, reply: any) {
  const loop = await svc.upsertLoop(request.auth, request.params.pipelineId, request.body)
  return reply.send({ data: loop })
}

export async function deletePipelineLoop(request: any, reply: any) {
  await svc.deleteLoop(request.auth, request.params.pipelineId)
  return reply.status(204).send()
}

export async function previewPipelineBatch(request: any, reply: any) {
  const preview = await svc.preview(request.auth, request.params.pipelineId, request.body ?? {})
  return reply.send({ data: preview })
}

export async function startPipelineBatch(request: any, reply: any) {
  const batch = await svc.startBatch(request.auth, request.params.pipelineId, request.body ?? {})
  return reply.status(201).send({ data: batch })
}

export async function listPipelineBatches(request: any, reply: any) {
  const batches = await svc.listBatches(request.auth, request.params.pipelineId)
  return reply.send({ data: batches })
}

export async function getPipelineBatch(request: any, reply: any) {
  const batch = await svc.getBatch(request.auth, request.params.batchId)
  return reply.send({ data: batch })
}
