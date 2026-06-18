import { db } from '@project/db'
import { getAdapter } from './adapters/FeedAdapter'
import type { FeedItem } from './adapters/FeedAdapter'
import { OpenAIService } from './OpenAIService'
import { fetchYoutubeTranscript } from './youtube/youtubeTranscript'
import { contentFieldsFromFeedItem, contentFieldsFromTranscript } from './researchContentStatus'
import { createHash } from 'crypto'

const REMOTE_CACHE_TTL_MS = 60 * 60 * 1000
const YOUTUBE_MISSING_TRANSCRIPT_CACHE_TTL_MS = 5 * 60 * 1000

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

async function uniqueSlug(accountId: string, base: string): Promise<string> {
  let slug = base
  let n = 2
  while (await db.researchSource.findUnique({ where: { accountId_slug: { accountId, slug } } })) {
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
      return cached.value
    }

    const adapter = getAdapter(sourceType)
    try {
      const value = await adapter.resolveSource(sourceUrl)
      await this.setCached(cacheKey, { ok: true, value })
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
      | { ok: false; error: string }
    >(cacheKey)
    if (cached) {
      if (!cached.ok) throw new Error(cached.error)
      return cached.items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt) }))
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
      await this.setCached(cacheKey, { ok: false, error: err.message ?? 'Research fetch failed' })
      throw err
    }
  }

  async list(accountId: string) {
    const sources = await db.researchSource.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    })
    return sources.map((s) => ({ ...s, itemCount: s._count.items, _count: undefined }))
  }

  async get(idOrSlug: string) {
    const source = await db.researchSource.findFirstOrThrow({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { _count: { select: { items: true } } },
    })
    return { ...source, itemCount: source._count.items, _count: undefined }
  }

  async create(accountId: string, data: { name: string; category?: string; sourceType?: string; sourceUrl: string }) {
    const sourceType = data.sourceType ?? 'youtube'
    const baseSlug = toSlug(data.name) || 'source'
    const slug = await uniqueSlug(accountId, baseSlug)

    let externalId: string | null = null
    try {
      externalId = await this.resolveSourceCached(sourceType, data.sourceUrl)
    } catch {}

    const source = await db.researchSource.create({
      data: {
        accountId,
        name: data.name,
        slug,
        category: data.category ?? null,
        sourceType,
        sourceUrl: data.sourceUrl,
        externalId,
      },
      include: { _count: { select: { items: true } } },
    })
    return { ...source, itemCount: source._count.items, _count: undefined }
  }

  async update(sourceId: string, data: { name?: string; category?: string; sourceUrl?: string; status?: string }) {
    let externalId: string | undefined = undefined
    if (data.sourceUrl) {
      const source = await db.researchSource.findUnique({ where: { id: sourceId }, select: { sourceType: true } })
      try {
        externalId = (await this.resolveSourceCached(source?.sourceType ?? 'youtube', data.sourceUrl)) ?? undefined
      } catch {}
    }

    const source = await db.researchSource.update({
      where: { id: sourceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl, externalId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { _count: { select: { items: true } } },
    })
    return { ...source, itemCount: source._count.items, _count: undefined }
  }

  async delete(sourceId: string) {
    await db.researchSource.delete({ where: { id: sourceId } })
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

  async checkLatest(sourceId: string): Promise<{
    checked: boolean
    newItem: boolean
    newCount: number
    updatedCount: number
    item?: object
    latest?: ReturnType<ResearchService['latestFromItem']>
  }> {
    const source = await db.researchSource.findFirstOrThrow({ where: { OR: [{ id: sourceId }, { slug: sourceId }] } })

    let externalId = source.externalId
    if (!externalId) {
      externalId = await this.resolveSourceCached(source.sourceType, source.sourceUrl).catch(() => null)
      if (externalId) {
        await db.researchSource.update({ where: { id: source.id }, data: { externalId } })
      }
    }

    if (!externalId) return { checked: false, newItem: false, newCount: 0, updatedCount: 0 }

    const feedItems = await this.fetchLatestCached(source.sourceType, externalId, source.sourceUrl)
    await db.researchSource.update({ where: { id: source.id }, data: { lastChecked: new Date() } })

    let newCount = 0
    let updatedCount = 0
    let firstNew: object | undefined = undefined
    let latest: ReturnType<ResearchService['latestFromItem']> | undefined

    for (const feedItem of feedItems) {
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
          updatedCount++
          latest = this.latestFromItem(updated, false, true)
          continue
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

          if (source.sourceType === 'youtube' || contentChanged) {
            updatedCount++
          }
          latest = this.latestFromItem(updated, false, true)
          continue
        }

        latest = this.latestFromItem(existing, false, false)
        continue
      }

      const contentFields = contentFieldsFromFeedItem(feedItem)
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
      if (!firstNew) firstNew = created
      newCount++
      latest = this.latestFromItem(created, true, true)
    }

    return { checked: true, newItem: newCount > 0, newCount, updatedCount, item: firstNew, latest }
  }

  async listItems(sourceId: string, page = 1, limit = 15) {
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

  async getItem(itemId: string) {
    const item = await db.researchItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { _count: { select: { summaries: true } } },
    })
    return this.formatItem(item)
  }

  async refreshItemContent(itemId: string) {
    const item = await db.researchItem.findUniqueOrThrow({
      where: { id: itemId },
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

  async listSummaries(itemId: string) {
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

  async summarize(itemId: string, promptId: string) {
    const [item, prompt] = await Promise.all([
      db.researchItem.findUniqueOrThrow({ where: { id: itemId } }),
      db.summaryPrompt.findUniqueOrThrow({ where: { id: promptId } }),
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
