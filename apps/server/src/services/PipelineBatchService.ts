import { db, Prisma } from '@project/db'
import { PipelineRunService } from './PipelineRunService'
import { authorization, type AuthContext } from './AuthorizationService'

const runService = new PipelineRunService()

export interface BatchOptions {
  dryRun?: boolean
  cursorMode?: string
  dateRangeStart?: string
  dateRangeEnd?: string
}

function formatLoop(loop: any) {
  return {
    id: loop.id,
    pipelineId: loop.pipelineId,
    loopType: loop.loopType,
    sourceId: loop.sourceId ?? undefined,
    sourceName: loop.source?.name ?? undefined,
    cursorMode: loop.cursorMode,
    cursorAt: loop.cursorAt ?? undefined,
    dateRangeStart: loop.dateRangeStart ?? undefined,
    dateRangeEnd: loop.dateRangeEnd ?? undefined,
    variableMap: loop.variableMap ?? undefined,
    maxBatchSize: loop.maxBatchSize,
    createdAt: loop.createdAt,
    updatedAt: loop.updatedAt,
  }
}

export class PipelineBatchService {
  async getLoop(context: AuthContext, pipelineId: string) {
    const id = await this.resolvePipelineId(context, pipelineId)
    const loop = await db.pipelineLoop.findUnique({
      where: { pipelineId: id },
      include: { source: { select: { name: true } } },
    })
    return loop ? formatLoop(loop) : null
  }

  async upsertLoop(context: AuthContext, pipelineId: string, data: {
    loopType: string
    sourceId?: string
    cursorMode: string
    cursorAt?: string
    dateRangeStart?: string
    dateRangeEnd?: string
    variableMap?: Record<string, string>
    maxBatchSize?: number
  }) {
    authorization.authorize(context, 'resource:edit')
    const id = await this.resolvePipelineId(context, pipelineId)
    if (data.sourceId) {
      const source = await db.researchSource.findFirst({
        where: { id: data.sourceId, OR: [{ workspaceId: context.workspaceId }, { visibility: 'PUBLIC', subscriptions: { some: { workspaceId: context.workspaceId } } }] },
      })
      if (!source) throw Object.assign(new Error('Research source not found'), { statusCode: 404 })
    }
    const loop = await db.pipelineLoop.upsert({
      where: { pipelineId: id },
      create: {
        pipelineId: id,
        loopType: data.loopType,
        sourceId: data.sourceId ?? null,
        cursorMode: data.cursorMode,
        cursorAt: data.cursorAt ? new Date(data.cursorAt) : null,
        dateRangeStart: data.dateRangeStart ? new Date(data.dateRangeStart) : null,
        dateRangeEnd: data.dateRangeEnd ? new Date(data.dateRangeEnd) : null,
        variableMap: data.variableMap ?? Prisma.JsonNull,
        maxBatchSize: data.maxBatchSize ?? 50,
      },
      update: {
        loopType: data.loopType,
        sourceId: data.sourceId ?? null,
        cursorMode: data.cursorMode,
        cursorAt: data.cursorAt ? new Date(data.cursorAt) : null,
        dateRangeStart: data.dateRangeStart ? new Date(data.dateRangeStart) : null,
        dateRangeEnd: data.dateRangeEnd ? new Date(data.dateRangeEnd) : null,
        variableMap: data.variableMap ?? Prisma.JsonNull,
        maxBatchSize: data.maxBatchSize ?? 50,
      },
      include: { source: { select: { name: true } } },
    })
    return formatLoop(loop)
  }

  async deleteLoop(context: AuthContext, pipelineId: string) {
    authorization.authorize(context, 'resource:edit')
    const id = await this.resolvePipelineId(context, pipelineId)
    await db.pipelineLoop.deleteMany({ where: { pipelineId: id } })
  }

  async preview(context: AuthContext, pipelineId: string, options: BatchOptions) {
    const id = await this.resolvePipelineId(context, pipelineId)
    const loop = await db.pipelineLoop.findUnique({
      where: { pipelineId: id },
      include: { source: true },
    })
    if (!loop) throw Object.assign(new Error('No loop configured for this pipeline'), { statusCode: 400 })
    if (!loop.sourceId) throw Object.assign(new Error('Loop has no research source configured'), { statusCode: 400 })

    const items = await this.resolveItems(loop, options)
    const pipeline = await db.pipeline.findFirst({
      where: { id },
      include: { agents: { where: { enabled: true } } },
    })
    const agentCount = pipeline?.agents.length ?? 0
    // Server-side cap — preview reflects the same cap applied at startBatch
    const capped = items.length > loop.maxBatchSize
    const cappedItems = items.slice(0, loop.maxBatchSize)

    return {
      itemCount: cappedItems.length,
      agentCount,
      estimatedCalls: cappedItems.length * agentCount,
      capped,
      maxBatchSize: loop.maxBatchSize,
      items: cappedItems.map((item) => ({
        itemId: item.id,
        title: item.title,
        publishedAt: item.publishedAt,
      })),
    }
  }

  async startBatch(context: AuthContext, pipelineId: string, options: BatchOptions) {
    authorization.authorize(context, 'pipeline:run')
    const id = await this.resolvePipelineId(context, pipelineId)
    const loop = await db.pipelineLoop.findUnique({
      where: { pipelineId: id },
      include: { source: true },
    })
    if (!loop) throw Object.assign(new Error('No loop configured for this pipeline'), { statusCode: 400 })
    if (!loop.sourceId || !loop.source) throw Object.assign(new Error('Loop has no research source configured'), { statusCode: 400 })

    // Idempotency guard: reject if a batch is already active for this pipeline
    const activeBatch = await db.pipelineRunBatch.findFirst({
      where: { pipelineId: id, status: { in: ['queued', 'running'] } },
    })
    if (activeBatch) {
      throw Object.assign(
        new Error('A batch is already running for this pipeline. Wait for it to complete before starting another.'),
        { statusCode: 409 },
      )
    }

    const items = await this.resolveItems(loop, options)
    // Server-side cap: maxBatchSize from the loop config is the single source of truth
    const cappedItems = items.slice(0, loop.maxBatchSize)
    if (cappedItems.length === 0) throw Object.assign(new Error('No items found for this batch'), { statusCode: 400 })

    // Snapshot cursorMode at batch creation so cursor advance uses the mode that
    // was active when this batch started, not the loop's current config
    const batchCursorMode = options.cursorMode ?? loop.cursorMode
    const dryRun = options.dryRun !== undefined ? options.dryRun : true

    const batch = await db.pipelineRunBatch.create({
      data: {
        pipelineId: id,
        loopType: loop.loopType,
        sourceId: loop.sourceId,
        sourceName: loop.source.name,
        cursorMode: batchCursorMode,
        dryRun,
        status: 'running',
        totalCount: cappedItems.length,
      },
    })

    // Execute asynchronously so the HTTP response returns immediately
    this._executeBatch({
      batchId: batch.id,
      items: cappedItems,
      loop,
      batchCursorMode,
      workspaceId: context.workspaceId,
      userId: context.userId,
      dryRun,
    }).catch(async () => {
      await db.pipelineRunBatch.update({
        where: { id: batch.id },
        data: { status: 'failed', completedAt: new Date() },
      })
    })

    return this.formatBatch(batch, [])
  }

  async listBatches(context: AuthContext, pipelineId: string) {
    const id = await this.resolvePipelineId(context, pipelineId)
    const batches = await db.pipelineRunBatch.findMany({
      where: { pipelineId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        runs: {
          select: {
            id: true,
            title: true,
            status: true,
            dryRun: true,
            loopIndex: true,
            startedAt: true,
            completedAt: true,
            error: true,
            variables: true,
          },
          orderBy: { loopIndex: 'asc' },
        },
      },
    })
    return batches.map((b) => this.formatBatch(b, b.runs))
  }

  async getBatch(context: AuthContext, batchId: string) {
    const batch = await db.pipelineRunBatch.findFirst({
      where: { id: batchId, pipeline: { workspaceId: context.workspaceId } },
      include: {
        runs: {
          select: {
            id: true,
            title: true,
            status: true,
            dryRun: true,
            loopIndex: true,
            startedAt: true,
            completedAt: true,
            error: true,
            variables: true,
          },
          orderBy: { loopIndex: 'asc' },
        },
      },
    })
    if (!batch) throw Object.assign(new Error('Batch not found'), { statusCode: 404 })
    return this.formatBatch(batch, batch.runs)
  }

  private async _executeBatch(input: {
    batchId: string
    items: Array<{ id: string; title: string; publishedAt: Date | null }>
    loop: any
    batchCursorMode: string
    workspaceId: string
    userId: string
    dryRun: boolean
  }) {
    const { batchId, items, loop, batchCursorMode, workspaceId, userId, dryRun } = input
    let completed = 0
    let failed = 0
    // Track the latest publishedAt of items whose run DB records were durably created.
    // Cursor advances to this value after all runs are submitted, not after they complete.
    let latestSubmittedAt: Date | null = null

    const variableMap = (loop.variableMap ?? {}) as Record<string, string>
    const ITEM_FIELDS: Record<string, string> = {
      title: 'title',
      itemUrl: 'itemUrl',
      publishedAt: 'publishedAt',
      externalId: 'externalId',
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item) continue

      const extraVariables: Record<string, string> = {}
      if (Object.keys(variableMap).length > 0) {
        const fullItem = await db.researchItem.findUnique({ where: { id: item.id } })
        if (fullItem) {
          for (const [varKey, fieldName] of Object.entries(variableMap)) {
            const val = (fullItem as any)[ITEM_FIELDS[fieldName] ?? '']
            if (val !== undefined && val !== null) extraVariables[varKey] = String(val)
          }
        }
      }

      try {
        // awaitExecution: true runs each item to completion before starting the next,
        // keeping concurrent OpenAI calls at a manageable level.
        // startRun with awaitExecution only throws if the DB record creation fails.
        // Execution failures are returned as run.status === 'failed' (no throw).
        const finalRun = await runService.startRun(
          loop.pipelineId,
          extraVariables,
          {
            dryRun,
            title: item.title,
            // Pin this specific research item so {source.field} variables resolve to it
            researchItemOverrides: { [loop.sourceId]: item.id },
            workspaceId,
            createdByUserId: userId,
            batchId,
            loopIndex: i,
            awaitExecution: true,
          },
        )

        // Run DB record was durably created — advance cursor past this item
        if (item.publishedAt) latestSubmittedAt = item.publishedAt

        if ((finalRun as any).status === 'failed') {
          failed++
        } else {
          completed++
        }
      } catch {
        // DB record creation failed — item was never submitted, don't advance cursor for it
        failed++
      }

      await db.pipelineRunBatch.update({
        where: { id: batchId },
        data: { completedCount: completed, failedCount: failed },
      })
    }

    // Advance cursor only after all run records are durably created.
    // Use batchCursorMode (snapshotted at batch start) not the loop's current config.
    if (batchCursorMode === 'new_since_cursor' && latestSubmittedAt !== null) {
      await db.pipelineLoop.update({
        where: { id: loop.id },
        data: { cursorAt: latestSubmittedAt },
      })
    }

    const finalStatus =
      failed === items.length
        ? 'failed'
        : failed > 0
          ? 'completed_with_failures'
          : 'completed'

    await db.pipelineRunBatch.update({
      where: { id: batchId },
      data: { status: finalStatus, completedAt: new Date() },
    })
  }

  private async resolveItems(loop: any, options: BatchOptions) {
    const cursorMode = options.cursorMode ?? loop.cursorMode

    if (cursorMode === 'date_range') {
      const start = options.dateRangeStart ?? loop.dateRangeStart
      const end = options.dateRangeEnd ?? loop.dateRangeEnd
      if (!start || !end) throw Object.assign(new Error('date_range mode requires dateRangeStart and dateRangeEnd'), { statusCode: 400 })
      return db.researchItem.findMany({
        where: {
          sourceId: loop.sourceId,
          publishedAt: { gte: new Date(start), lte: new Date(end) },
        },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true, publishedAt: true },
      })
    }

    if (cursorMode === 'new_since_cursor') {
      const cursor = loop.cursorAt
      if (!cursor) {
        return db.researchItem.findMany({
          where: { sourceId: loop.sourceId },
          orderBy: { publishedAt: 'asc' },
          select: { id: true, title: true, publishedAt: true },
        })
      }
      return db.researchItem.findMany({
        where: { sourceId: loop.sourceId, publishedAt: { gt: cursor } },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true, publishedAt: true },
      })
    }

    return db.researchItem.findMany({
      where: { sourceId: loop.sourceId },
      orderBy: { publishedAt: 'asc' },
      select: { id: true, title: true, publishedAt: true },
    })
  }

  private formatBatch(batch: any, runs: any[]) {
    return {
      id: batch.id,
      pipelineId: batch.pipelineId,
      label: batch.label ?? undefined,
      loopType: batch.loopType,
      sourceId: batch.sourceId ?? undefined,
      sourceName: batch.sourceName ?? undefined,
      cursorMode: batch.cursorMode ?? undefined,
      dryRun: batch.dryRun,
      status: batch.status,
      totalCount: batch.totalCount,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      skippedCount: batch.skippedCount,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt ?? undefined,
      runs: runs.map((r) => {
        const vars = (r.variables ?? {}) as Record<string, any>
        const pinnedItem = Object.values(vars).find(
          (v) => v && typeof v === 'object' && 'title' in v && 'sourceId' in v,
        ) as any
        return {
          id: r.id,
          title: r.title ?? undefined,
          status: r.status,
          dryRun: r.dryRun,
          loopIndex: r.loopIndex ?? 0,
          pinnedItemTitle: pinnedItem?.title ?? undefined,
          startedAt: r.startedAt,
          completedAt: r.completedAt ?? undefined,
          error: r.error ?? undefined,
        }
      }),
    }
  }

  private async resolvePipelineId(context: AuthContext, idOrSlug: string): Promise<string> {
    const p = await db.pipeline.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    })
    if (!p) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    return p.id
  }
}
