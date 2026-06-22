import { WorkflowService } from '../services/WorkflowService'
import { PipelineRunService } from '../services/PipelineRunService'
import { authorization } from '../services/AuthorizationService'
import { db } from '@project/db'

const service = new WorkflowService()
const runService = new PipelineRunService()

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

export async function startWorkflowRun(request: any, reply: any) {
  authorization.authorize(request.auth, 'pipeline:run')
  const { variables, dryRun, title } = request.body ?? {}
  const run = await runService.startWorkflowRun(request.params.workflowId, variables ?? {}, {
    dryRun,
    title,
    workspaceId: request.auth.workspaceId,
    createdByUserId: request.auth.userId,
  })
  return reply.status(201).send({ data: run })
}

export async function listWorkflowRuns(request: any, reply: any) {
  const limit = Math.min(Number(request.query?.limit ?? 20), 100)
  // Resolve workflow idOrSlug to id
  const workflow = await db.workflow.findFirst({
    where: {
      workspaceId: request.auth.workspaceId,
      OR: [{ id: request.params.workflowId }, { slug: request.params.workflowId }],
    },
    select: { id: true, name: true, slug: true },
  })
  if (!workflow) return reply.status(404).send({ error: 'Workflow not found' })

  const rows = await db.pipelineRun.findMany({
    where: { workspaceId: request.auth.workspaceId, workflowId: workflow.id },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { _count: { select: { agentRuns: true, assets: true } } },
  })

  return reply.send({
    data: rows.map((r) => {
      const post = r.generatedPost as Record<string, unknown> | null
      return {
        id: r.id,
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowSlug: workflow.slug,
        title: r.title ?? undefined,
        status: r.status,
        dryRun: r.dryRun,
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? undefined,
        error: r.error ?? undefined,
        hasPost: post !== null,
        postTitle: typeof post?.title === 'string' ? post.title : undefined,
        variables: r.variables as Record<string, unknown>,
        agentCount: r._count.agentRuns,
        assetCount: r._count.assets,
      }
    }),
  })
}
