import { db, Prisma } from '@project/db'
import { PipelineRunService } from './PipelineRunService'
import { authorization, type AuthContext } from './AuthorizationService'
import { importDataset, type DatasetConfig, type DatasetImportInput } from './DatasetImportService'

const runService = new PipelineRunService()

export interface BatchOptions {
  dryRun?: boolean
  cursorMode?: string
  dateRangeStart?: string
  dateRangeEnd?: string
}

interface BatchItem {
  id: string
  title: string
  publishedAt: Date | null
  researchItemId?: string
  row?: Record<string, string>
}

function formatLoop(loop: any) {
  const dataset = loop.datasetConfig as DatasetConfig | null
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
    dataset: dataset ? {
      sourceType: dataset.sourceType,
      name: dataset.name,
      url: dataset.url,
      headers: dataset.headers,
      rowCount: dataset.rows.length,
    } : undefined,
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
    dataset?: DatasetImportInput
    maxBatchSize?: number
  }) {
    authorization.authorize(context, 'resource:edit')
    const id = await this.resolvePipelineId(context, pipelineId)
    if (data.sourceId) {
      const source = await db.researchSource.findFirst({
        where: { id: data.sourceId, workspaceId: context.workspaceId },
      })
      if (!source) throw Object.assign(new Error('Research source not found'), { statusCode: 404 })
    }
    const datasetConfig = data.loopType === 'dataset'
      ? await importDataset(data.dataset ?? { sourceType: 'csv' })
      : null
    const maxBatchSize = datasetConfig?.rows.length ?? data.maxBatchSize ?? 50
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
        datasetConfig: datasetConfig ? datasetConfig as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        maxBatchSize,
      },
      update: {
        loopType: data.loopType,
        sourceId: data.sourceId ?? null,
        cursorMode: data.cursorMode,
        cursorAt: data.cursorAt ? new Date(data.cursorAt) : null,
        dateRangeStart: data.dateRangeStart ? new Date(data.dateRangeStart) : null,
        dateRangeEnd: data.dateRangeEnd ? new Date(data.dateRangeEnd) : null,
        variableMap: data.variableMap ?? Prisma.JsonNull,
        datasetConfig: datasetConfig ? datasetConfig as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        maxBatchSize,
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
    if (loop.loopType === 'research_feed' && !loop.sourceId) throw Object.assign(new Error('Loop has no research source configured'), { statusCode: 400 })

    const items = await this.resolveItems(loop, options)
    const pipeline = await db.pipeline.findFirst({
      where: { id },
      include: { agents: { where: { enabled: true } }, variables: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    if (loop.loopType === 'dataset') this.validateDataset(loop, pipeline.variables)
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
        publishedAt: item.publishedAt ?? undefined,
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
    if (loop.loopType === 'research_feed' && (!loop.sourceId || !loop.source)) throw Object.assign(new Error('Loop has no research source configured'), { statusCode: 400 })

    const pipeline = await db.pipeline.findFirst({
      where: { id },
      include: { variables: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    if (loop.loopType === 'dataset') this.validateDataset(loop, pipeline.variables)

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
        sourceName: loop.loopType === 'dataset'
          ? ((loop.datasetConfig as unknown as DatasetConfig)?.name ?? 'Dataset')
          : loop.source?.name,
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
      pipelineVariables: pipeline.variables,
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
    items: BatchItem[]
    loop: any
    batchCursorMode: string
    workspaceId: string
    userId: string
    dryRun: boolean
    pipelineVariables: Array<{ key: string; type: string; defaultValue: string | null }>
  }) {
    const { batchId, items, loop, batchCursorMode, workspaceId, userId, dryRun, pipelineVariables } = input
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

      const extraVariables: Record<string, unknown> = {}
      if (loop.loopType === 'dataset' && item.row) {
        Object.assign(extraVariables, this.datasetVariables(item.row, pipelineVariables, i))
      } else if (Object.keys(variableMap).length > 0) {
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
            researchItemOverrides: loop.sourceId && item.researchItemId ? { [loop.sourceId]: item.researchItemId } : undefined,
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
    if (loop.loopType === 'dataset') {
      const dataset = loop.datasetConfig as DatasetConfig | null
      if (!dataset?.rows?.length) throw Object.assign(new Error('Loop has no dataset configured'), { statusCode: 400 })
      return dataset.rows.map((row, index): BatchItem => ({
        id: `row-${index + 1}`,
        title: row.title?.trim() || row.name?.trim() || `Row ${index + 1}`,
        publishedAt: null,
        row,
      }))
    }

    const cursorMode = options.cursorMode ?? loop.cursorMode

    if (cursorMode === 'date_range') {
      const start = options.dateRangeStart ?? loop.dateRangeStart
      const end = options.dateRangeEnd ?? loop.dateRangeEnd
      if (!start || !end) throw Object.assign(new Error('date_range mode requires dateRangeStart and dateRangeEnd'), { statusCode: 400 })
      const items = await db.researchItem.findMany({
        where: {
          sourceId: loop.sourceId,
          publishedAt: { gte: new Date(start), lte: new Date(end) },
        },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true, publishedAt: true },
      })
      return items.map((item) => ({ ...item, researchItemId: item.id }))
    }

    if (cursorMode === 'new_since_cursor') {
      const cursor = loop.cursorAt
      if (!cursor) {
        const items = await db.researchItem.findMany({
          where: { sourceId: loop.sourceId },
          orderBy: { publishedAt: 'asc' },
          select: { id: true, title: true, publishedAt: true },
        })
        return items.map((item) => ({ ...item, researchItemId: item.id }))
      }
      const items = await db.researchItem.findMany({
        where: { sourceId: loop.sourceId, publishedAt: { gt: cursor } },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true, publishedAt: true },
      })
      return items.map((item) => ({ ...item, researchItemId: item.id }))
    }

    const items = await db.researchItem.findMany({
      where: { sourceId: loop.sourceId },
      orderBy: { publishedAt: 'asc' },
      select: { id: true, title: true, publishedAt: true },
    })
    return items.map((item) => ({ ...item, researchItemId: item.id }))
  }

  private validateDataset(loop: any, variables: Array<{ key: string; required: boolean; defaultValue: string | null; type: string }>) {
    const dataset = loop.datasetConfig as DatasetConfig | null
    if (!dataset?.rows?.length) throw Object.assign(new Error('No dataset rows are configured'), { statusCode: 400 })
    const headerSet = new Set(dataset.headers)
    const conflicts = variables.filter((variable) => headerSet.has(variable.key) && variable.defaultValue !== null)
    if (conflicts.length > 0) {
      throw Object.assign(new Error(`Dataset columns conflict with static variable values: ${conflicts.map((variable) => variable.key).join(', ')}`), { statusCode: 400 })
    }
    const missing = variables.filter((variable) => variable.required && variable.defaultValue === null && !headerSet.has(variable.key))
    if (missing.length > 0) {
      throw Object.assign(new Error(`Dataset is missing required variables: ${missing.map((variable) => variable.key).join(', ')}`), { statusCode: 400 })
    }
    for (let index = 0; index < dataset.rows.length; index++) {
      for (const variable of variables) {
        if (!headerSet.has(variable.key)) continue
        const value = dataset.rows[index]?.[variable.key] ?? ''
        if (variable.required && !value.trim()) {
          throw Object.assign(new Error(`Row ${index + 1} has no value for required variable "${variable.key}"`), { statusCode: 400 })
        }
        if (value.trim()) this.coerceDatasetValue(value, variable.type, variable.key, index)
      }
    }
  }

  private datasetVariables(row: Record<string, string>, variables: Array<{ key: string; type: string; defaultValue: string | null }>, rowIndex: number) {
    const values: Record<string, unknown> = { row }
    for (const variable of variables) {
      const rowValue = row[variable.key]
      if (rowValue !== undefined) {
        values[variable.key] = rowValue.trim() ? this.coerceDatasetValue(rowValue, variable.type, variable.key, rowIndex) : ''
      } else if (variable.defaultValue !== null) {
        values[variable.key] = variable.defaultValue
      }
    }
    return values
  }

  private coerceDatasetValue(value: string, type: string, key: string, rowIndex: number): unknown {
    if (type === 'number') {
      const number = Number(value)
      if (!Number.isFinite(number)) throw Object.assign(new Error(`Row ${rowIndex + 1} has an invalid number for "${key}"`), { statusCode: 400 })
      return number
    }
    if (type === 'boolean') {
      const normalized = value.trim().toLowerCase()
      if (['true', 'yes', '1'].includes(normalized)) return true
      if (['false', 'no', '0'].includes(normalized)) return false
      throw Object.assign(new Error(`Row ${rowIndex + 1} has an invalid boolean for "${key}"`), { statusCode: 400 })
    }
    if (type === 'json') {
      try { return JSON.parse(value) } catch { throw Object.assign(new Error(`Row ${rowIndex + 1} has invalid JSON for "${key}"`), { statusCode: 400 }) }
    }
    return value
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
