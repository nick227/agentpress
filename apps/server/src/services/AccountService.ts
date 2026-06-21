import { db } from '@project/db'
import { ResearchService } from './ResearchService'
import { formatResearchCheckMessage } from './researchCheckMessage'
import { PipelineRunService } from './PipelineRunService'
import type { AuthContext } from './AuthorizationService'

export class AccountService {
  async navigation(context: AuthContext) {
    const [pipelines, schedules, researchSources, destinations] = await Promise.all([
      db.pipeline.findMany({
        where: { workspaceId: context.workspaceId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          runs: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true, status: true } },
        },
      }),
      db.schedule.findMany({
        where: { workspaceId: context.workspaceId },
        orderBy: { name: 'asc' },
        include: { executions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true } } },
      }),
      db.researchSource.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, status: true, lastChecked: true } }),
      db.destination.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    ])
    return {
      pipelines: pipelines.map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        slug: pipeline.slug,
        status: pipeline.status,
        lastRunAt: pipeline.runs[0]?.startedAt,
        lastRunStatus: pipeline.runs[0]?.status,
      })),
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt ?? undefined,
        lastExecutionAt: schedule.executions[0]?.createdAt,
        lastExecutionStatus: schedule.executions[0]?.status,
      })),
      researchSources: researchSources.map((source) => ({
        id: source.id,
        name: source.name,
        slug: source.slug,
        status: source.status,
        lastCheckedAt: source.lastChecked ?? undefined,
      })),
      destinations,
    }
  }

  async sync(context: AuthContext) {
    const research = new ResearchService()
    const runs = new PipelineRunService()

    const sources = await db.researchSource.findMany({
      where: { status: 'active', workspaceId: context.workspaceId },
    })

    const researchResults: Array<{ sourceName: string; sourceId: string; newItem: boolean; updatedCount?: number; itemTitle?: string; statusMessage?: string; error?: string }> = []

    for (const source of sources) {
      try {
        const result = await research.checkLatest(context, source.id)
        const statusMessage = formatResearchCheckMessage(source.sourceType, result)
        const transcriptFailed = source.sourceType === 'youtube' && result.latest && !result.latest.hasTranscript
        researchResults.push({
          sourceName: source.name,
          sourceId: source.id,
          newItem: result.newItem,
          updatedCount: result.updatedCount,
          itemTitle: result.latest?.title ?? (result.newItem && result.item ? (result.item as { title: string }).title : undefined),
          statusMessage,
          error: !result.checked ? statusMessage : transcriptFailed ? statusMessage : undefined,
        })
      } catch (err: any) {
        researchResults.push({ sourceName: source.name, sourceId: source.id, newItem: false, error: err.message ?? 'Unknown error' })
      }
    }

    const pipelines = await db.pipeline.findMany({
      where: { status: { not: 'paused' }, workspaceId: context.workspaceId },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { where: { enabled: true } },
        runs: { where: { status: 'running' }, take: 1 },
      },
    })

    const pipelineResults: Array<{ pipelineName: string; pipelineId: string; status: 'started' | 'skipped'; runId?: string; reason?: string }> = []

    for (const pipeline of pipelines) {
      if (pipeline.agents.length === 0) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: 'No enabled agents' })
        continue
      }
      if (pipeline.runs.length > 0) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: 'Run already in progress' })
        continue
      }
      try {
        const defaultVars: Record<string, string> = {}
        for (const v of pipeline.variables) {
          defaultVars[v.key] = v.defaultValue ?? ''
        }
        const run = await runs.startRun(pipeline.id, defaultVars, { workspaceId: context.workspaceId, createdByUserId: context.userId })
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'started', runId: run.id })
      } catch (err: any) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: err.message ?? 'Failed to start' })
      }
    }

    return {
      research: {
        checked: researchResults.length,
        newItems: researchResults.filter((r) => r.newItem).length,
        results: researchResults,
      },
      pipelines: {
        started: pipelineResults.filter((r) => r.status === 'started').length,
        skipped: pipelineResults.filter((r) => r.status === 'skipped').length,
        results: pipelineResults,
      },
    }
  }
}
