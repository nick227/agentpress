import { randomUUID } from 'crypto'
import { db, Prisma } from '@project/db'
import { PipelineRunService } from './PipelineRunService'
import { ResearchService } from './ResearchService'
import { evaluateFreshness } from './scheduleFreshness'

const LEASE_MS = 10 * 60_000

export class ScheduleExecutor {
  private research = new ResearchService()
  private pipelineRuns = new PipelineRunService()

  async enqueue(scheduleId: string, origin: 'manual' | 'timer', scheduledFor?: Date) {
    const dedupeKey = origin === 'timer' && scheduledFor
      ? `timer:${scheduleId}:${scheduledFor.toISOString()}`
      : `manual:${scheduleId}:${randomUUID()}`
    const execution = await db.scheduleExecution.create({
      data: { scheduleId, origin, scheduledFor, dedupeKey },
    })
    void this.execute(execution.id)
    return execution
  }

  async execute(executionId: string) {
    const now = new Date()
    const claimed = await db.scheduleExecution.updateMany({
      where: {
        id: executionId,
        OR: [
          { status: 'queued' },
          { status: 'running', leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'running',
        startedAt: now,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        error: null,
      },
    })
    if (claimed.count === 0) return db.scheduleExecution.findUnique({ where: { id: executionId } })

    try {
      const execution = await db.scheduleExecution.findUniqueOrThrow({
        where: { id: executionId },
        include: {
          schedule: {
            include: {
              sources: { include: { source: true }, orderBy: { sortOrder: 'asc' } },
              pipelineActions: {
                include: {
                  triggerSources: true,
                  pipeline: {
                    include: {
                      variables: { orderBy: { sortOrder: 'asc' } },
                      agents: { where: { enabled: true } },
                    },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      })

      const successfulSources = new Set<string>()
      if (execution.schedule.pipelineActions.some((action) => action.pipeline.workspaceId !== execution.schedule.workspaceId)) {
        throw new Error('Schedule contains a pipeline from another workspace')
      }
      const externalSourceIds = execution.schedule.sources
        .filter(({ source }) => source.workspaceId !== execution.schedule.workspaceId)
        .map(({ source }) => source.id)
      if (externalSourceIds.length > 0) {
        const allowed = await db.workspaceFeedSubscription.count({
          where: {
            workspaceId: execution.schedule.workspaceId,
            sourceId: { in: externalSourceIds },
            source: { visibility: 'PUBLIC' },
          },
        })
        if (allowed !== externalSourceIds.length) throw new Error('Schedule contains an inaccessible research feed')
      }
      let hadFailure = false
      for (const { source } of execution.schedule.sources) {
        await this.renewLease(executionId)
        const check = await db.scheduleResearchCheck.upsert({
          where: { executionId_sourceId: { executionId, sourceId: source.id } },
          create: {
            executionId,
            sourceId: source.id,
            sourceName: source.name,
            status: 'running',
            startedAt: new Date(),
          },
          update: { status: 'running', startedAt: new Date(), completedAt: null, newCount: 0, updatedCount: 0, error: null },
        })
        try {
          const result = await this.research.checkLatest(null, source.id)
          if (!result.checked) throw new Error(result.message ?? 'Research feed check failed')
          successfulSources.add(source.id)
          await db.scheduleResearchCheck.update({
            where: { id: check.id },
            data: {
              status: 'completed',
              newCount: result.newCount,
              updatedCount: result.updatedCount,
              completedAt: new Date(),
            },
          })
        } catch (error: any) {
          hadFailure = true
          await db.scheduleResearchCheck.update({
            where: { id: check.id },
            data: { status: 'failed', error: error.message ?? String(error), completedAt: new Date() },
          })
        }
      }

      const cutoffAt = new Date()
      await db.scheduleExecution.update({ where: { id: executionId }, data: { cutoffAt } })

      for (const action of execution.schedule.pipelineActions) {
        await this.renewLease(executionId)
        const prior = await db.schedulePipelineExecution.findFirst({
          where: { executionId, actionId: action.id },
          include: { pipelineRun: true },
        })
        const actionExecution = prior ?? await db.schedulePipelineExecution.create({
          data: {
            executionId,
            actionId: action.id,
            pipelineId: action.pipeline.id,
            pipelineName: action.pipeline.name,
            status: 'evaluating',
          },
        })

        if (prior?.pipelineRun) {
          await this.advanceCursors(action.triggerSources, successfulSources, cutoffAt)
          continue
        }

        if (action.pipeline.status !== 'active') {
          await this.skipPipelineExecution(actionExecution.id, `Pipeline is ${action.pipeline.status}`)
          continue
        }
        if (action.pipeline.agents.length === 0) {
          await this.skipPipelineExecution(actionExecution.id, 'Pipeline has no enabled agents')
          continue
        }
        const overrides = (action.variableOverrides ?? {}) as Record<string, unknown>
        const missingVariables = action.pipeline.variables.filter((variable) =>
          variable.required && !String(overrides[variable.key] ?? variable.defaultValue ?? '').trim(),
        )
        if (missingVariables.length > 0) {
          await this.skipPipelineExecution(
            actionExecution.id,
            `Missing required variables: ${missingVariables.map((variable) => variable.key).join(', ')}`,
          )
          continue
        }
        const running = await db.pipelineRun.findFirst({
          where: { pipelineId: action.pipeline.id, status: { in: ['queued', 'running'] } },
          select: { id: true },
        })
        if (running) {
          await this.skipPipelineExecution(actionExecution.id, 'Pipeline already has a run in progress')
          continue
        }

        const eligibleBySource: Record<string, string[]> = {}
        const pinnedBySource: Record<string, string> = {}
        if (action.triggerPolicy !== 'always') {
          for (const trigger of action.triggerSources) {
            if (!successfulSources.has(trigger.sourceId)) continue
            const items = await db.researchItem.findMany({
              where: {
                sourceId: trigger.sourceId,
                createdAt: { gt: trigger.cursorAt, lte: cutoffAt },
              },
              orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
              select: { id: true },
            })
            if (items.length > 0) {
              eligibleBySource[trigger.sourceId] = items.map((item) => item.id)
              pinnedBySource[trigger.sourceId] = items[0]!.id
            }
          }
          const decision = evaluateFreshness(
            action.triggerPolicy,
            action.triggerSources.map((trigger) => trigger.sourceId),
            successfulSources,
            eligibleBySource,
          )
          if (!decision.shouldRun) {
            await db.schedulePipelineExecution.update({
              where: { id: actionExecution.id },
              data: {
                status: 'skipped',
                reason: decision.reason,
                eligibleItemIds: eligibleBySource,
                pinnedItemIds: pinnedBySource,
                completedAt: new Date(),
              },
            })
            await this.advanceCursors(action.triggerSources, successfulSources, cutoffAt)
            continue
          }
        }

        const variables = Object.fromEntries(action.pipeline.variables.map((variable) => [
          variable.key,
          overrides[variable.key] ?? variable.defaultValue ?? '',
        ]))
        await db.schedulePipelineExecution.update({
          where: { id: actionExecution.id },
          data: {
            status: 'dispatching',
            eligibleItemIds: eligibleBySource as Prisma.InputJsonValue,
            pinnedItemIds: pinnedBySource as Prisma.InputJsonValue,
            reason: null,
          },
        })
        try {
          await this.pipelineRuns.startRun(action.pipeline.id, variables, {
            workspaceId: execution.schedule.workspaceId,
            createdByUserId: execution.schedule.createdByUserId ?? undefined,
            schedulePipelineExecutionId: actionExecution.id,
            researchItemOverrides: pinnedBySource,
          })
          await db.schedulePipelineExecution.update({
            where: { id: actionExecution.id },
            data: { status: 'started', completedAt: new Date() },
          })
          await this.advanceCursors(action.triggerSources, successfulSources, cutoffAt)
        } catch (error: any) {
          hadFailure = true
          await db.schedulePipelineExecution.update({
            where: { id: actionExecution.id },
            data: { status: 'failed', reason: error.message ?? String(error), completedAt: new Date() },
          })
        }
      }

      const completedAt = new Date()
      await db.$transaction([
        db.scheduleExecution.update({
          where: { id: executionId },
          data: {
            status: hadFailure ? 'partial' : 'completed',
            completedAt,
            leaseExpiresAt: null,
          },
        }),
        db.schedule.update({
          where: { id: execution.scheduleId },
          data: { lastRunAt: completedAt },
        }),
      ])
    } catch (error: any) {
      await db.scheduleExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          error: error.message ?? String(error),
          completedAt: new Date(),
          leaseExpiresAt: null,
        },
      })
    }
    return db.scheduleExecution.findUnique({ where: { id: executionId } })
  }

  private async advanceCursors(
    triggers: Array<{ id: string; sourceId: string }>,
    successfulSources: Set<string>,
    cutoffAt: Date,
  ) {
    const ids = triggers.filter((trigger) => successfulSources.has(trigger.sourceId)).map((trigger) => trigger.id)
    if (ids.length > 0) {
      await db.schedulePipelineTriggerSource.updateMany({ where: { id: { in: ids } }, data: { cursorAt: cutoffAt } })
    }
  }

  private async skipPipelineExecution(id: string, reason: string) {
    await db.schedulePipelineExecution.update({
      where: { id },
      data: { status: 'skipped', reason, completedAt: new Date() },
    })
  }

  private async renewLease(executionId: string) {
    await db.scheduleExecution.update({
      where: { id: executionId },
      data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    })
  }
}
