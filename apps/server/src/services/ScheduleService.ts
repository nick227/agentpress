import { db, Prisma } from '@project/db'
import { nextScheduleOccurrence, validateTimezone } from './scheduleRecurrence'

const TRIGGER_POLICIES = ['always', 'any_checked_feed_new', 'selected_feeds_new'] as const
type TriggerPolicy = typeof TRIGGER_POLICIES[number]

export interface ScheduleActionInput {
  id?: string
  pipelineId: string
  triggerPolicy: TriggerPolicy
  triggerSourceIds?: string[]
  variableOverrides?: Record<string, unknown>
}

export interface ScheduleInput {
  name: string
  enabled?: boolean
  cadenceType?: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  timezone?: string
  minuteOfHour?: number | null
  timeOfDay?: string | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  sourceIds?: string[]
  pipelineActions?: ScheduleActionInput[]
}

const includeSchedule = {
  sources: { include: { source: true }, orderBy: { sortOrder: 'asc' as const } },
  pipelineActions: {
    include: {
      pipeline: { include: { variables: { orderBy: { sortOrder: 'asc' as const } } } },
      triggerSources: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.ScheduleInclude

function apiError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

export class ScheduleService {
  async list(accountId: string) {
    const schedules = await db.schedule.findMany({
      where: { accountId },
      include: {
        _count: { select: { sources: true, pipelineActions: true } },
        executions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    })
    return schedules.map((schedule) => ({
      id: schedule.id,
      accountId: schedule.accountId,
      name: schedule.name,
      enabled: schedule.enabled,
      cadenceType: schedule.cadenceType,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt ?? undefined,
      lastRunAt: schedule.lastRunAt ?? undefined,
      sourceCount: schedule._count.sources,
      pipelineCount: schedule._count.pipelineActions,
      lastExecutionStatus: schedule.executions[0]?.status,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }))
  }

  async get(scheduleId: string) {
    const schedule = await db.schedule.findUnique({ where: { id: scheduleId }, include: includeSchedule })
    return schedule ? this.format(schedule) : null
  }

  async create(accountId: string, input: ScheduleInput) {
    const normalized = await this.validate(accountId, input)
    const schedule = await db.schedule.create({
      data: {
        accountId,
        ...normalized.fields,
        sources: {
          create: normalized.sourceIds.map((sourceId, sortOrder) => ({ sourceId, sortOrder })),
        },
        pipelineActions: {
          create: normalized.actions.map((action, sortOrder) => ({
            pipelineId: action.pipelineId,
            triggerPolicy: action.triggerPolicy,
            variableOverrides: action.variableOverrides as Prisma.InputJsonValue,
            sortOrder,
            triggerSources: {
              create: action.relevantSourceIds.map((sourceId) => ({ sourceId })),
            },
          })),
        },
      },
      include: includeSchedule,
    })
    return this.format(schedule)
  }

  async update(scheduleId: string, input: ScheduleInput) {
    const existing = await db.schedule.findUniqueOrThrow({ where: { id: scheduleId } })
    const normalized = await this.validate(existing.accountId, input)

    await db.$transaction(async (tx) => {
      await tx.schedule.update({ where: { id: scheduleId }, data: normalized.fields })

      await tx.scheduleSource.deleteMany({
        where: { scheduleId, sourceId: { notIn: normalized.sourceIds } },
      })
      for (const [sortOrder, sourceId] of normalized.sourceIds.entries()) {
        await tx.scheduleSource.upsert({
          where: { scheduleId_sourceId: { scheduleId, sourceId } },
          create: { scheduleId, sourceId, sortOrder },
          update: { sortOrder },
        })
      }

      const keptActionIds: string[] = []
      for (const [sortOrder, action] of normalized.actions.entries()) {
        const priorById = action.id
          ? await tx.schedulePipelineAction.findFirst({ where: { id: action.id, scheduleId } })
          : null
        // Changing the pipeline creates a new consumer identity and therefore new
        // source cursors; an old action's freshness must never carry across.
        const prior = priorById?.pipelineId === action.pipelineId
          ? priorById
          : await tx.schedulePipelineAction.findUnique({
              where: { scheduleId_pipelineId: { scheduleId, pipelineId: action.pipelineId } },
            })
        const saved = prior
          ? await tx.schedulePipelineAction.update({
              where: { id: prior.id },
              data: {
                pipelineId: action.pipelineId,
                triggerPolicy: action.triggerPolicy,
                variableOverrides: action.variableOverrides as Prisma.InputJsonValue,
                sortOrder,
              },
            })
          : await tx.schedulePipelineAction.create({
              data: {
                scheduleId,
                pipelineId: action.pipelineId,
                triggerPolicy: action.triggerPolicy,
                variableOverrides: action.variableOverrides as Prisma.InputJsonValue,
                sortOrder,
              },
            })
        keptActionIds.push(saved.id)

        await tx.schedulePipelineTriggerSource.deleteMany({
          where: { actionId: saved.id, sourceId: { notIn: action.relevantSourceIds } },
        })
        for (const sourceId of action.relevantSourceIds) {
          await tx.schedulePipelineTriggerSource.upsert({
            where: { actionId_sourceId: { actionId: saved.id, sourceId } },
            create: { actionId: saved.id, sourceId },
            update: {},
          })
        }
      }
      await tx.schedulePipelineAction.deleteMany({
        where: { scheduleId, id: { notIn: keptActionIds } },
      })
    })

    return this.format(await db.schedule.findUniqueOrThrow({ where: { id: scheduleId }, include: includeSchedule }))
  }

  async delete(scheduleId: string) {
    await db.schedule.delete({ where: { id: scheduleId } })
  }

  async listExecutions(scheduleId: string, limit = 25) {
    const executions = await db.scheduleExecution.findMany({
      where: { scheduleId },
      include: {
        researchChecks: true,
        pipelineExecutions: { include: { pipelineRun: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    })
    const itemMap = await this.getPinnedItemMap(executions)
    return executions.map((execution) => this.formatExecution(execution, itemMap))
  }

  async getExecution(executionId: string) {
    const execution = await db.scheduleExecution.findUnique({
      where: { id: executionId },
      include: {
        schedule: true,
        researchChecks: true,
        pipelineExecutions: { include: { pipelineRun: true } },
      },
    })
    if (!execution) return null
    return this.formatExecution(execution, await this.getPinnedItemMap([execution]))
  }

  private format(schedule: any) {
    return {
      id: schedule.id,
      accountId: schedule.accountId,
      name: schedule.name,
      enabled: schedule.enabled,
      cadenceType: schedule.cadenceType,
      timezone: schedule.timezone,
      minuteOfHour: schedule.minuteOfHour ?? undefined,
      timeOfDay: schedule.timeOfDay ?? undefined,
      dayOfWeek: schedule.dayOfWeek ?? undefined,
      dayOfMonth: schedule.dayOfMonth ?? undefined,
      nextRunAt: schedule.nextRunAt ?? undefined,
      lastRunAt: schedule.lastRunAt ?? undefined,
      sourceIds: schedule.sources.map((entry: any) => entry.sourceId),
      sources: schedule.sources.map((entry: any) => entry.source),
      pipelineActions: schedule.pipelineActions.map((action: any) => ({
        id: action.id,
        pipelineId: action.pipelineId,
        pipelineName: action.pipeline.name,
        pipelineStatus: action.pipeline.status,
        dryRun: action.pipeline.dryRun,
        destinationId: action.pipeline.destinationId ?? undefined,
        triggerPolicy: action.triggerPolicy,
        triggerSourceIds: action.triggerSources.map((entry: any) => entry.sourceId),
        variableOverrides: action.variableOverrides ?? {},
        pipelineVariables: action.pipeline.variables,
      })),
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }
  }

  private formatExecution(execution: any, itemMap: Map<string, { id: string; sourceId: string; title: string }>) {
    return {
      id: execution.id,
      scheduleId: execution.scheduleId,
      origin: execution.origin,
      status: execution.status,
      scheduledFor: execution.scheduledFor ?? undefined,
      cutoffAt: execution.cutoffAt ?? undefined,
      skipReason: execution.skipReason ?? undefined,
      error: execution.error ?? undefined,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      createdAt: execution.createdAt,
      researchChecks: execution.researchChecks.map((check: any) => ({
        id: check.id,
        sourceId: check.sourceId ?? undefined,
        sourceName: check.sourceName,
        status: check.status,
        newCount: check.newCount,
        updatedCount: check.updatedCount,
        error: check.error ?? undefined,
      })),
      pipelineExecutions: execution.pipelineExecutions.map((item: any) => {
        const pinnedItemIds = (item.pinnedItemIds ?? {}) as Record<string, string>
        return {
          id: item.id,
          pipelineId: item.pipelineId,
          pipelineName: item.pipelineName,
          status: item.status,
          reason: item.reason ?? undefined,
          eligibleItemIds: item.eligibleItemIds ?? {},
          pinnedItemIds,
          pinnedItems: Object.entries(pinnedItemIds).flatMap(([sourceId, itemId]) => {
            const researchItem = itemMap.get(itemId)
            return researchItem ? [{ sourceId, itemId, title: researchItem.title }] : []
          }),
          pipelineRunId: item.pipelineRun?.id,
          pipelineRunStatus: item.pipelineRun?.status,
        }
      }),
    }
  }

  private async getPinnedItemMap(executions: any[]) {
    const ids = [...new Set(executions.flatMap((execution) =>
      execution.pipelineExecutions.flatMap((item: any) => Object.values(item.pinnedItemIds ?? {})),
    ).filter((id): id is string => typeof id === 'string'))]
    const items = ids.length > 0
      ? await db.researchItem.findMany({ where: { id: { in: ids } }, select: { id: true, sourceId: true, title: true } })
      : []
    return new Map(items.map((item) => [item.id, item]))
  }

  private async validate(accountId: string, input: ScheduleInput) {
    const name = input.name?.trim()
    if (!name) throw apiError('Schedule name is required')
    const sourceIds = [...new Set(input.sourceIds ?? [])]
    const actions = input.pipelineActions ?? []
    if (sourceIds.length === 0 && actions.length === 0) {
      throw apiError('Add at least one research feed or pipeline')
    }
    if (new Set(actions.map((action) => action.pipelineId)).size !== actions.length) {
      throw apiError('A pipeline can only appear once in a schedule')
    }

    const [sources, pipelines] = await Promise.all([
      db.researchSource.findMany({ where: { id: { in: sourceIds }, accountId } }),
      db.pipeline.findMany({
        where: { id: { in: actions.map((action) => action.pipelineId) }, accountId },
        include: { variables: true },
      }),
    ])
    if (sources.length !== sourceIds.length) throw apiError('Every research feed must belong to this account')
    if (pipelines.length !== actions.length) throw apiError('Every pipeline must belong to this account')
    const pipelineById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]))

    const normalizedActions = actions.map((action) => {
      if (!TRIGGER_POLICIES.includes(action.triggerPolicy)) throw apiError('Invalid pipeline trigger policy')
      const selected = [...new Set(action.triggerSourceIds ?? [])]
      const relevantSourceIds = action.triggerPolicy === 'always'
        ? []
        : action.triggerPolicy === 'any_checked_feed_new'
          ? sourceIds
          : selected
      if (action.triggerPolicy !== 'always' && relevantSourceIds.length === 0) {
        throw apiError('Conditional pipeline actions require at least one trigger feed')
      }
      if (relevantSourceIds.some((sourceId) => !sourceIds.includes(sourceId))) {
        throw apiError('Pipeline trigger feeds must be checked by the schedule')
      }

      const pipeline = pipelineById.get(action.pipelineId)!
      const overrides = action.variableOverrides ?? {}
      return { ...action, variableOverrides: overrides, relevantSourceIds }
    })

    const cadenceType = input.cadenceType ?? 'manual'
    const timezone = input.timezone || 'UTC'
    validateTimezone(timezone)
    if (!['manual', 'hourly', 'daily', 'weekly', 'monthly'].includes(cadenceType)) throw apiError('Invalid cadence')
    if (cadenceType === 'hourly' && ((input.minuteOfHour ?? 0) < 0 || (input.minuteOfHour ?? 0) > 59)) {
      throw apiError('Minute of hour must be between 0 and 59')
    }
    if (['daily', 'weekly', 'monthly'].includes(cadenceType) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeOfDay ?? '')) {
      throw apiError('A valid local time is required')
    }
    if (cadenceType === 'weekly' && ((input.dayOfWeek ?? -1) < 0 || (input.dayOfWeek ?? -1) > 6)) {
      throw apiError('Day of week must be between 0 and 6')
    }
    if (cadenceType === 'monthly' && ((input.dayOfMonth ?? 0) < 1 || (input.dayOfMonth ?? 0) > 28)) {
      throw apiError('Day of month must be between 1 and 28')
    }
    const enabled = cadenceType === 'manual' ? false : (input.enabled ?? false)
    const nextRunAt = enabled
      ? nextScheduleOccurrence({
          cadenceType,
          timezone,
          minuteOfHour: input.minuteOfHour,
          timeOfDay: input.timeOfDay,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
        })
      : null

    return {
      sourceIds,
      actions: normalizedActions,
      fields: {
        name,
        enabled,
        cadenceType,
        timezone,
        minuteOfHour: input.minuteOfHour ?? null,
        timeOfDay: input.timeOfDay ?? null,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        nextRunAt,
      },
    }
  }
}
