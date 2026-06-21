import { db } from '@project/db'
import { getAdapter } from './adapters/FeedAdapter'
import type { FeedItem } from './adapters/FeedAdapter'
import { OpenAIService } from './OpenAIService'
import { fetchYoutubeTranscript } from './youtube/youtubeTranscript'
import { contentFieldsFromFeedItem, contentFieldsFromTranscript } from './researchContentStatus'
import { resolveGlobalDefaultSummaryPrompt } from './summaryPromptResolve'
import { formatResearchCheckMessage } from './researchCheckMessage'
import { createHash } from 'crypto'
import { authorization, type AuthContext } from './AuthorizationService'

const REMOTE_CACHE_TTL_MS = 60 * 60 * 1000
const YOUTUBE_MISSING_TRANSCRIPT_CACHE_TTL_MS = 5 * 60 * 1000

class ResearchFetchError extends Error {
  readonly code = 'RESEARCH_FETCH_FAILED'
  readonly retryable = true

  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ResearchFetchError'
  }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function canonicalCategory(category?: string | null): string {
  const value = category?.trim().toLowerCase() || 'uncategorized'
  if (value === 'tech') return 'technology'
  if (value === 'finance') return 'financial'
  if (value === 'political') return 'politics'
  return value
}

function assertPublicSourceUrlSafe(sourceUrl: string) {
  let url: URL
  try { url = new URL(sourceUrl) } catch { throw Object.assign(new Error('A valid source URL is required'), { statusCode: 400 }) }
  const sensitiveParam = [...url.searchParams.keys()].some((key) => /token|key|secret|password|auth/i.test(key))
  if (url.username || url.password || sensitiveParam) {
    throw Object.assign(new Error('Credentialed source URLs cannot be public'), { statusCode: 400 })
  }
}

async function uniqueSlug(base: string, workspaceId: string): Promise<string> {
  let slug = base
  let n = 2
  while (await db.researchSource.findFirst({ where: { slug, workspaceId } })) {
    slug = `${base}-${n++}`
  }
  return slug
}

export class ResearchService {
  private ai = new OpenAIService()

  private cacheId(cacheKey: string): string {
    return createHash('sha256').update(cacheKey).digest('hex')
  }

  private async getCached<T>(cacheKey: string): Promise<T | undefined> {
    const row = await db.researchFetchCache.findUnique({ where: { id: this.cacheId(cacheKey) } })
    if (!row || row.expiresAt <= new Date()) return undefined
    return row.payload as T
  }

  private async setCached(cacheKey: string, payload: unknown, ttlMs = REMOTE_CACHE_TTL_MS): Promise<void> {
    await db.researchFetchCache.upsert({
      where: { id: this.cacheId(cacheKey) },
      update: {
        cacheKey,
        payload: payload as any,
        expiresAt: new Date(Date.now() + ttlMs),
      },
      create: {
        id: this.cacheId(cacheKey),
        cacheKey,
        payload: payload as any,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })
  }

  private fetchCacheTtl(sourceType: string, items: FeedItem[]): number {
    if (sourceType === 'youtube' && items.some((item) => !item.content.trim())) {
      return YOUTUBE_MISSING_TRANSCRIPT_CACHE_TTL_MS
    }
    return REMOTE_CACHE_TTL_MS
  }

  private async backfillYoutubeContent(externalId: string) {
    return contentFieldsFromTranscript(await fetchYoutubeTranscript(externalId))
  }

  private formatItem(item: {
    id: string
    sourceId: string
    externalId: string
    title: string
    itemUrl: string
    publishedAt: Date
    content: string | null
    contentStatus: string | null
    contentErrorReason: string | null
    contentCheckedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: { summaries: number }
  }) {
    return {
      ...item,
      summaryCount: item._count.summaries,
      _count: undefined,
    }
  }

  private async resolveSourceCached(sourceType: string, sourceUrl: string): Promise<string | null> {
    const cacheKey = `research:resolve:${sourceType}:${sourceUrl}`
    const cached = await this.getCached<{ ok: true; value: string | null } | { ok: false; error: string }>(cacheKey)
    if (cached !== undefined) {
      if (!cached.ok) throw new Error(cached.error)
      if (cached.value) return cached.value
    }

    const adapter = getAdapter(sourceType)
    try {
      const value = await adapter.resolveSource(sourceUrl)
      if (value) {
        await this.setCached(cacheKey, { ok: true, value })
      }
      return value
    } catch (err: any) {
      await this.setCached(cacheKey, { ok: false, error: err.message ?? 'Source resolution failed' })
      throw err
    }
  }

  private async fetchLatestCached(sourceType: string, externalId: string, sourceUrl: string): Promise<FeedItem[]> {
    const cacheKey = `research:fetch:${sourceType}:${externalId}`
    const cached = await this.getCached<
      | { ok: true; items: Array<Omit<FeedItem, 'publishedAt'> & { publishedAt: string }> }
      | { ok: false; error: string; rateLimited?: boolean; retryAfterSeconds?: number; statusCode?: number }
    >(cacheKey)
    if (cached) {
      if (cached.ok) {
        return cached.items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt) }))
      }

      throw new ResearchFetchError(cached.error, cached.statusCode ?? 502, cached.retryAfterSeconds)
    }

    const adapter = getAdapter(sourceType)
    try {
      const items = await adapter.fetchLatest(externalId, sourceUrl)
      await this.setCached(
        cacheKey,
        {
          ok: true,
          items: items.map((item) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
        },
        this.fetchCacheTtl(sourceType, items),
      )
      return items
    } catch (err: any) {
      const upstreamMessage = err instanceof Error ? err.message : 'The upstream service did not respond'
      const rateLimited = /\b429\b|rate[ -]?limit/i.test(upstreamMessage)
      const notFound = /\b404\b|not[ -]?found/i.test(upstreamMessage)
      const transcriptUnavailable = /transcript/i.test(upstreamMessage)

      let message = 'Provider error. Cached for one hour.'
      if (rateLimited) {
        message = 'Provider rate limited. Try again later.'
      } else if (notFound) {
        message = 'Source could not be found.'
      } else if (transcriptUnavailable) {
        message = 'Video found, but transcript unavailable.'
      }

      const retryAfterSeconds = rateLimited ? 3600 : undefined

      await this.setCached(
        cacheKey,
        {
          ok: false,
          error: message,
          rateLimited,
          statusCode: rateLimited ? 429 : 502,
          retryAfterSeconds
        },
        REMOTE_CACHE_TTL_MS
      )

      throw new ResearchFetchError(message, rateLimited ? 429 : 502, retryAfterSeconds, { cause: err })
    }
  }

  private formatSource(
    source: {
      defaultSummaryPromptId: string | null
      defaultSummaryPrompt: { id: string; name: string } | null
      _count: { items: number }
    } & Record<string, unknown>,
    globalDefault: { id: string; name: string } | null,
  ) {
    const effective = source.defaultSummaryPrompt ?? globalDefault
    const { _count, defaultSummaryPrompt, ...rest } = source
    return {
      ...rest,
      defaultSummaryPromptId: source.defaultSummaryPromptId,
      defaultSummaryPromptName: source.defaultSummaryPrompt?.name ?? null,
      pipelineSummaryPromptId: effective?.id ?? null,
      pipelineSummaryPromptName: effective?.name ?? null,
      itemCount: _count.items,
    }
  }

  private sourceInclude() {
    return {
      _count: { select: { items: true } },
      defaultSummaryPrompt: { select: { id: true, name: true } },
    } as const
  }

  async list(context: AuthContext) {
    const [sources, globalDefault] = await Promise.all([
      db.researchSource.findMany({
        where: { workspaceId: context.workspaceId },
        orderBy: { name: 'asc' },
        include: this.sourceInclude(),
      }),
      resolveGlobalDefaultSummaryPrompt(),
    ])
    return sources.map((source) => this.formatSource(source, globalDefault))
  }

  async get(context: AuthContext, idOrSlug: string) {
    const [source, globalDefault] = await Promise.all([
      db.researchSource.findFirstOrThrow({
        where: {
          AND: [
            { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
            { workspaceId: context.workspaceId },
          ],
        },
        include: this.sourceInclude(),
      }),
      resolveGlobalDefaultSummaryPrompt(),
    ])
    return this.formatSource(source, globalDefault)
  }

  async create(context: AuthContext, data: { name: string; category?: string; sourceType?: string; sourceUrl: string; visibility?: 'PRIVATE' | 'PUBLIC' }) {
    authorization.authorize(context, 'resource:edit')
    if (data.visibility === 'PUBLIC') authorization.authorize(context, 'resource:visibility')
    if (data.visibility === 'PUBLIC') assertPublicSourceUrlSafe(data.sourceUrl)
    const sourceType = data.sourceType ?? 'youtube'
    const baseSlug = toSlug(data.name) || 'source'
    const slug = await uniqueSlug(baseSlug, context.workspaceId)

    let externalId: string | null = null
    try {
      externalId = await this.resolveSourceCached(sourceType, data.sourceUrl)
    } catch {}

    const source = await db.researchSource.create({
      data: {
        name: data.name,
        slug,
        category: data.category ?? null,
        sourceType,
        sourceUrl: data.sourceUrl,
        externalId,
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        visibility: data.visibility ?? 'PRIVATE',
      },
      include: this.sourceInclude(),
    })
    const globalDefault = await resolveGlobalDefaultSummaryPrompt()
    return this.formatSource(source, globalDefault)
  }

  async update(context: AuthContext, sourceId: string, data: {
    name?: string
    category?: string
    sourceUrl?: string
    status?: string
    defaultSummaryPromptId?: string | null
    visibility?: 'PRIVATE' | 'PUBLIC'
  }) {
    authorization.authorize(context, 'resource:edit')
    const owned = await db.researchSource.findFirst({ where: { id: sourceId, workspaceId: context.workspaceId } })
    if (!owned) throw Object.assign(new Error('Research source not found'), { statusCode: 404 })
    if (data.visibility !== undefined) authorization.authorize(context, 'resource:visibility')
    if (data.visibility === 'PUBLIC' || (owned.visibility === 'PUBLIC' && data.visibility !== 'PRIVATE')) {
      assertPublicSourceUrlSafe(data.sourceUrl ?? owned.sourceUrl)
    }
    let externalId: string | undefined = undefined
    if (data.sourceUrl) {
      const source = owned
      try {
        externalId = (await this.resolveSourceCached(source?.sourceType ?? 'youtube', data.sourceUrl)) ?? undefined
      } catch {}
    }

    if (data.defaultSummaryPromptId) {
      await db.prompt.findFirstOrThrow({ where: { id: data.defaultSummaryPromptId, kind: 'CONTENT' } })
    }

    const source = await db.researchSource.update({
      where: { id: sourceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl, externalId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.defaultSummaryPromptId !== undefined
          ? { defaultSummaryPromptId: data.defaultSummaryPromptId }
          : {}),
      },
      include: this.sourceInclude(),
    })
    const globalDefault = await resolveGlobalDefaultSummaryPrompt()
    return this.formatSource(source, globalDefault)
  }

  async delete(context: AuthContext, sourceId: string) {
    authorization.authorize(context, 'resource:delete')
    const source = await db.researchSource.findFirst({ where: { id: sourceId, workspaceId: context.workspaceId } })
    if (!source) throw Object.assign(new Error('Research source not found'), { statusCode: 404 })
    await db.researchSource.delete({ where: { id: source.id } })
  }

  private latestFromItem(
    item: {
      id: string
      title: string
      content: string | null
      contentStatus: string | null
      contentErrorReason: string | null
    },
    isNew: boolean,
    contentChecked: boolean,
  ) {
    const hasTranscript = Boolean(item.content?.trim())
    return {
      id: item.id,
      title: item.title,
      contentStatus: item.contentStatus ?? (hasTranscript ? 'ok' : 'unavailable'),
      contentErrorReason: item.contentErrorReason,
      hasTranscript,
      isNew,
      contentChecked,
    }
  }

  private async processFeedItem(
    source: { id: string; sourceType: string },
    feedItem: FeedItem,
  ): Promise<{
    isNew: boolean
    isUpdated: boolean
    item: object
    latest: ReturnType<ResearchService['latestFromItem']> | undefined
  }> {
    const existing = await db.researchItem.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId: feedItem.externalId } },
    })

    if (existing) {
      const contentFields = contentFieldsFromFeedItem(feedItem)
      const shouldRefreshExisting =
        source.sourceType === 'reddit' &&
        (
          existing.title !== feedItem.title ||
          existing.itemUrl !== feedItem.itemUrl ||
          existing.content !== contentFields.content ||
          existing.contentStatus !== contentFields.contentStatus
        )

      if (shouldRefreshExisting) {
        const updated = await db.researchItem.update({
          where: { id: existing.id },
          data: {
            title: feedItem.title,
            itemUrl: feedItem.itemUrl,
            publishedAt: feedItem.publishedAt,
            content: contentFields.content,
            contentStatus: contentFields.contentStatus,
            contentErrorReason: contentFields.contentErrorReason,
            contentCheckedAt: contentFields.contentCheckedAt,
          },
        })
        return { isNew: false, isUpdated: true, item: updated, latest: this.latestFromItem(updated, false, true) }
      }

      const shouldRetryContent =
        !existing.content?.trim() ||
        existing.contentStatus === 'rate_limited' ||
        existing.contentStatus === 'error'

      if (shouldRetryContent) {
        const fields =
          source.sourceType === 'youtube'
            ? await this.backfillYoutubeContent(feedItem.externalId)
            : contentFieldsFromFeedItem(feedItem)

        const contentChanged = Boolean(fields.content) || fields.contentStatus !== existing.contentStatus
        const updated = contentChanged
          ? await db.researchItem.update({
              where: { id: existing.id },
              data: {
                content: fields.content,
                contentStatus: fields.contentStatus,
                contentErrorReason: fields.contentErrorReason,
                contentCheckedAt: fields.contentCheckedAt,
              },
            })
          : existing

        const isUpdated = source.sourceType === 'youtube' || contentChanged
        return { isNew: false, isUpdated, item: updated, latest: this.latestFromItem(updated, false, true) }
      }

      return { isNew: false, isUpdated: false, item: existing, latest: this.latestFromItem(existing, false, false) }
    }

    const contentFields =
      source.sourceType === 'youtube'
        ? await this.backfillYoutubeContent(feedItem.externalId)
        : contentFieldsFromFeedItem(feedItem)
    const created = await db.researchItem.create({
      data: {
        sourceId: source.id,
        externalId: feedItem.externalId,
        title: feedItem.title,
        itemUrl: feedItem.itemUrl,
        publishedAt: feedItem.publishedAt,
        content: contentFields.content,
        contentStatus: contentFields.contentStatus,
        contentErrorReason: contentFields.contentErrorReason,
        contentCheckedAt: contentFields.contentCheckedAt,
      },
    })
    return { isNew: true, isUpdated: false, item: created, latest: this.latestFromItem(created, true, true) }
  }

  async checkLatest(contextOrSourceId: AuthContext | string | null, sourceIdArg?: string): Promise<{
    checked: boolean
    newItem: boolean
    newCount: number
    updatedCount: number
    item?: object
    latest?: ReturnType<ResearchService['latestFromItem']>
    message?: string
  }> {
    const context = typeof contextOrSourceId === 'string' ? null : contextOrSourceId
    const sourceId = typeof contextOrSourceId === 'string' ? contextOrSourceId : sourceIdArg
    if (!sourceId) throw Object.assign(new Error('Research source is required'), { statusCode: 400 })
    if (context) authorization.authorize(context, 'resource:edit')
    const source = await db.researchSource.findFirstOrThrow({
      where: {
        ...(context ? { workspaceId: context.workspaceId } : {}),
        OR: [{ id: sourceId }, { slug: sourceId }],
      },
    })

    let externalId = source.externalId?.trim() || null
    if (!externalId) {
      externalId = await this.resolveSourceCached(source.sourceType, source.sourceUrl).catch(() => null)
      if (externalId) {
        await db.researchSource.update({ where: { id: source.id }, data: { externalId } })
      }
    }

    if (!externalId) {
      return {
        checked: false,
        newItem: false,
        newCount: 0,
        updatedCount: 0,
        message: `Could not resolve ${source.sourceType === 'youtube' ? 'YouTube channel' : 'source'}. Check the URL.`,
      }
    }

    const feedItems = await this.fetchLatestCached(source.sourceType, externalId, source.sourceUrl)
    await db.researchSource.update({ where: { id: source.id }, data: { lastChecked: new Date() } })

    let newCount = 0
    let updatedCount = 0
    let firstNew: object | undefined = undefined
    let latest: ReturnType<ResearchService['latestFromItem']> | undefined

    for (const feedItem of feedItems) {
      const result = await this.processFeedItem(source, feedItem)
      if (result.isNew) {
        if (!firstNew) firstNew = result.item
        newCount++
      } else if (result.isUpdated) {
        updatedCount++
      }
      if (result.latest) latest = result.latest
    }

    return { checked: true, newItem: newCount > 0, newCount, updatedCount, item: firstNew, latest }
  }

  async checkMany(context: AuthContext, category?: string): Promise<{
    category?: string
    checked: number
    succeeded: number
    failed: number
    newCount: number
    updatedCount: number
    results: Array<{
      sourceId: string
      sourceName: string
      status: 'completed' | 'failed'
      newCount: number
      updatedCount: number
      message?: string
      error?: string
    }>
  }> {
    const requestedCategory = category ? canonicalCategory(category) : undefined
    const activeSources = await db.researchSource.findMany({
      where: { status: 'active', workspaceId: context.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sourceType: true, category: true },
    })
    const sources = requestedCategory
      ? activeSources.filter((source) => canonicalCategory(source.category) === requestedCategory)
      : activeSources

    const results: Array<{
      sourceId: string
      sourceName: string
      status: 'completed' | 'failed'
      newCount: number
      updatedCount: number
      message?: string
      error?: string
    }> = []

    // Keep checks sequential to avoid bursts against YouTube and Reddit rate limits.
    for (const source of sources) {
      try {
        const result = await this.checkLatest(context, source.id)
        const message = result.message ?? formatResearchCheckMessage(source.sourceType, result)
        if (!result.checked) {
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            status: 'failed',
            newCount: 0,
            updatedCount: 0,
            error: message,
          })
          continue
        }
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'completed',
          newCount: result.newCount,
          updatedCount: result.updatedCount,
          message,
        })
      } catch (error: unknown) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'failed',
          newCount: 0,
          updatedCount: 0,
          error: error instanceof Error ? error.message : 'Check failed',
        })
      }
    }

    return {
      ...(requestedCategory ? { category: requestedCategory } : {}),
      checked: sources.length,
      succeeded: results.filter((result) => result.status === 'completed').length,
      failed: results.filter((result) => result.status === 'failed').length,
      newCount: results.reduce((total, result) => total + result.newCount, 0),
      updatedCount: results.reduce((total, result) => total + result.updatedCount, 0),
      results,
    }
  }

  async listItems(context: AuthContext, sourceId: string, page = 1, limit = 15) {
    const source = await db.researchSource.findFirst({
      where: { id: sourceId, workspaceId: context.workspaceId },
    })
    if (!source) throw Object.assign(new Error('Research source not found'), { statusCode: 404 })
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      db.researchItem.findMany({
        where: { sourceId },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sourceId: true,
          externalId: true,
          title: true,
          itemUrl: true,
          publishedAt: true,
          contentStatus: true,
          contentCheckedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { summaries: true } },
        },
      }),
      db.researchItem.count({ where: { sourceId } }),
    ])
    const data = items.map((i) => ({ ...i, summaryCount: i._count.summaries, _count: undefined }))
    return { data, total, page, pages: Math.max(1, Math.ceil(total / limit)) }
  }

  async getItem(context: AuthContext, itemId: string) {
    const item = await db.researchItem.findFirstOrThrow({
      where: { id: itemId, source: { workspaceId: context.workspaceId } },
      include: { _count: { select: { summaries: true } } },
    })
    return this.formatItem(item)
  }

  async refreshItemContent(context: AuthContext, itemId: string) {
    authorization.authorize(context, 'resource:edit')
    const item = await db.researchItem.findFirstOrThrow({
      where: { id: itemId, source: { workspaceId: context.workspaceId } },
      include: { source: { select: { sourceType: true } } },
    })

    if (item.source.sourceType !== 'youtube') {
      throw Object.assign(new Error('Content refresh is only supported for YouTube items'), { statusCode: 400 })
    }

    const fields = contentFieldsFromTranscript(await fetchYoutubeTranscript(item.externalId))
    const updated = await db.researchItem.update({
      where: { id: itemId },
      data: {
        content: fields.content,
        contentStatus: fields.contentStatus,
        contentErrorReason: fields.contentErrorReason,
        contentCheckedAt: fields.contentCheckedAt,
      },
      include: { _count: { select: { summaries: true } } },
    })
    return this.formatItem(updated)
  }

  async listSummaries(context: AuthContext, itemId: string) {
    await db.researchItem.findFirstOrThrow({
      where: { id: itemId, source: { workspaceId: context.workspaceId } },
    })
    const rows = await db.researchSummary.findMany({
      where: { itemId },
      include: { prompt: { select: { name: true, description: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      ...r,
      promptName: r.prompt.name,
      promptDescription: r.prompt.description,
      prompt: undefined,
    }))
  }

  async summarize(context: AuthContext | null, itemId: string, promptId: string) {
    if (context) authorization.authorize(context, 'resource:edit')
    const [item, prompt] = await Promise.all([
      db.researchItem.findFirstOrThrow({
        where: { id: itemId, ...(context ? { source: { workspaceId: context.workspaceId } } : {}) },
      }),
      db.prompt.findFirstOrThrow({ where: { id: promptId, kind: 'CONTENT' } }),
    ])

    if (!item.content) {
      const row = await db.researchSummary.upsert({
        where: { itemId_promptId: { itemId, promptId } },
        update: { status: 'failed' },
        create: { itemId, promptId, status: 'failed' },
        include: { prompt: { select: { name: true, description: true } } },
      })
      return { ...row, promptName: row.prompt.name, promptDescription: row.prompt.description, prompt: undefined }
    }

    await db.researchSummary.upsert({
      where: { itemId_promptId: { itemId, promptId } },
      update: { status: 'processing' },
      create: { itemId, promptId, status: 'processing' },
    })

    try {
      const userPrompt = prompt.userPrompt.replace('{transcript}', item.content.slice(0, 12000))
      const text = await this.ai.generateText(prompt.systemPrompt, userPrompt)

      const row = await db.researchSummary.upsert({
        where: { itemId_promptId: { itemId, promptId } },
        update: { text: text.slice(0, 4000), status: 'done' },
        create: { itemId, promptId, text: text.slice(0, 4000), status: 'done' },
        include: { prompt: { select: { name: true, description: true } } },
      })
      return { ...row, promptName: row.prompt.name, promptDescription: row.prompt.description, prompt: undefined }
    } catch (err) {
      await db.researchSummary.upsert({
        where: { itemId_promptId: { itemId, promptId } },
        update: { status: 'failed' },
        create: { itemId, promptId, status: 'failed' },
      })
      throw err
    }
  }
}
