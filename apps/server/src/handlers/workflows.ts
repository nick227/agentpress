import { WorkflowService } from '../services/WorkflowService'

const service = new WorkflowService()

export async function listWorkflows(request: any, reply: any) {
  return reply.send({ data: await service.list(request.auth, request.query) })
}

export async function createWorkflow(request: any, reply: any) {
  return reply.status(201).send({ data: await service.create(request.auth, request.body) })
}

export async function getWorkflow(request: any, reply: any) {
  const data = await service.get(request.auth, request.params.workflowId)
  if (!data) return reply.status(404).send({ error: 'Workflow not found' })
  return reply.send({ data })
}

export async function updateWorkflow(request: any, reply: any) {
  return reply.send({ data: await service.update(request.auth, request.params.workflowId, request.body) })
}

export async function deleteWorkflow(request: any, reply: any) {
  await service.delete(request.auth, request.params.workflowId)
  return reply.send({ ok: true })
}

export async function insertWorkflowIntoPipeline(request: any, reply: any) {
  const { workflowId, insertAfterSortOrder } = request.body
  const data = await service.insertIntoPipeline(
    request.auth,
    workflowId,
    request.params.pipelineId,
    insertAfterSortOrder,
  )
  return reply.send({ data })
}
