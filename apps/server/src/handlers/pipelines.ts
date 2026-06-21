import { PipelineService } from '../services/PipelineService'

const svc = new PipelineService()

export async function listPipelines(request: any, reply: any) {
  const data = await svc.list(request.auth)
  return reply.send({ data })
}

export async function getPipeline(request: any, reply: any) {
  const result = await svc.get(request.auth, request.params.pipelineId)
  if (!result) return reply.status(404).send({ error: 'Pipeline not found' })
  return reply.send(result)
}

export async function createPipeline(request: any, reply: any) {
  const data = await svc.create(request.auth, request.body)
  return reply.status(201).send({ data })
}

export async function updatePipeline(request: any, reply: any) {
  const data = await svc.update(request.auth, request.params.pipelineId, request.body)
  return reply.send({ data })
}

export async function deletePipeline(request: any, reply: any) {
  await svc.delete(request.auth, request.params.pipelineId)
  return reply.send({ ok: true })
}

export async function validatePipeline(request: any, reply: any) {
  const data = await svc.validate(request.auth, request.params.pipelineId)
  return reply.send({ data })
}

export async function promptAssist(request: any, reply: any) {
  const { PromptAssistService } = await import('../services/PromptAssistService')
  const assistSvc = new PromptAssistService()
  const data = await assistSvc.assist(request.body)
  return reply.send({ data })
}
