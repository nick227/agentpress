import { PipelineRunService } from '../services/PipelineRunService'
import { db } from '@project/db'

const svc = new PipelineRunService()

export async function startPipelineRun(request: any, reply: any) {
  const { variables, dryRun } = request.body
  const run = await svc.startRun(request.params.pipelineId, variables, dryRun)
  return reply.status(201).send({ data: run })
}

export async function getPipelineRun(request: any, reply: any) {
  const run = await db.pipelineRun.findUniqueOrThrow({
    where: { id: request.params.runId },
    include: {
      agentRuns: { orderBy: { sortOrder: 'asc' } },
      assets: { orderBy: { createdAt: 'asc' } },
      publishAttempts: { orderBy: { createdAt: 'asc' } },
    },
  })

  return reply.send({
    data: {
      id: run.id,
      accountId: run.accountId,
      pipelineId: run.pipelineId,
      status: run.status,
      dryRun: run.dryRun,
      variables: run.variables,
      generatedPost: run.generatedPost ?? undefined,
      outputFolder: run.outputFolder ?? undefined,
      destinationId: run.destinationId ?? undefined,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? undefined,
      error: run.error ?? undefined,
    },
    agentRuns: run.agentRuns.map((a) => ({
      id: a.id,
      pipelineRunId: a.pipelineRunId,
      agentUid: a.agentUid,
      agentName: a.agentName,
      outputTarget: a.outputTarget,
      renderedSystemPrompt: a.renderedSystemPrompt,
      renderedUserPrompt: a.renderedUserPrompt,
      outputText: a.outputText ?? undefined,
      outputJson: a.outputJson ?? undefined,
      status: a.status,
      error: a.error ?? undefined,
      sortOrder: a.sortOrder,
      startedAt: a.startedAt ?? undefined,
      completedAt: a.completedAt ?? undefined,
    })),
    assets: run.assets.map((a) => ({
      id: a.id,
      pipelineRunId: a.pipelineRunId,
      type: a.type,
      label: a.label,
      filename: a.filename,
      path: a.path,
      url: a.url ?? undefined,
      createdAt: a.createdAt,
    })),
    publishAttempts: run.publishAttempts.map((p) => ({
      id: p.id,
      pipelineRunId: p.pipelineRunId,
      destinationId: p.destinationId,
      status: p.status,
      remotePostId: p.remotePostId ?? undefined,
      remoteUrl: p.remoteUrl ?? undefined,
      error: p.error ?? undefined,
      createdAt: p.createdAt,
    })),
  })
}
