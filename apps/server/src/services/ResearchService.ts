import { db } from '@project/db'
import { YoutubeService } from './YoutubeService'
import { OpenAIService } from './OpenAIService'

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
  private yt = new YoutubeService()
  private ai = new OpenAIService()

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

  async create(accountId: string, data: { name: string; category?: string; youtubeUrl: string }) {
    const baseSlug = toSlug(data.name) || 'source'
    const slug = await uniqueSlug(accountId, baseSlug)

    let channelId: string | null = null
    try {
      channelId = await this.yt.resolveChannelId(data.youtubeUrl)
    } catch {}

    const source = await db.researchSource.create({
      data: { accountId, name: data.name, slug, category: data.category ?? null, youtubeUrl: data.youtubeUrl, channelId },
      include: { _count: { select: { items: true } } },
    })
    return { ...source, itemCount: source._count.items, _count: undefined }
  }

  async update(sourceId: string, data: { name?: string; category?: string; youtubeUrl?: string; status?: string }) {
    let channelId: string | undefined = undefined
    if (data.youtubeUrl) {
      try {
        channelId = (await this.yt.resolveChannelId(data.youtubeUrl)) ?? undefined
      } catch {}
    }

    const source = await db.researchSource.update({
      where: { id: sourceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl, channelId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { _count: { select: { items: true } } },
    })
    return { ...source, itemCount: source._count.items, _count: undefined }
  }

  async delete(sourceId: string) {
    await db.researchSource.delete({ where: { id: sourceId } })
  }

  async checkLatest(sourceId: string): Promise<{ checked: boolean; newItem: boolean; item?: object }> {
    const source = await db.researchSource.findUniqueOrThrow({ where: { id: sourceId } })

    let channelId = source.channelId
    if (!channelId) {
      channelId = await this.yt.resolveChannelId(source.youtubeUrl)
      if (channelId) {
        await db.researchSource.update({ where: { id: sourceId }, data: { channelId } })
      }
    }

    if (!channelId) {
      await db.researchSource.update({ where: { id: sourceId }, data: { lastChecked: new Date() } })
      return { checked: false, newItem: false }
    }

    const latest = await this.yt.getLatestVideo(channelId)
    await db.researchSource.update({ where: { id: sourceId }, data: { lastChecked: new Date() } })

    if (!latest) return { checked: true, newItem: false }

    const existing = await db.researchItem.findUnique({
      where: { sourceId_videoId: { sourceId, videoId: latest.videoId } },
    })
    if (existing) return { checked: true, newItem: false }

    const transcript = await this.yt.fetchTranscript(latest.videoId)

    const item = await db.researchItem.create({
      data: {
        sourceId,
        videoId: latest.videoId,
        videoTitle: latest.title,
        videoUrl: `https://www.youtube.com/watch?v=${latest.videoId}`,
        publishedAt: latest.publishedAt,
        transcript,
      },
    })

    return { checked: true, newItem: true, item }
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
          videoId: true,
          videoTitle: true,
          videoUrl: true,
          publishedAt: true,
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
    return { ...item, summaryCount: item._count.summaries, _count: undefined }
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

    const existing = await db.researchSummary.findUnique({
      where: { itemId_promptId: { itemId, promptId } },
    })

    if (!item.transcript) {
      const row = await db.researchSummary.upsert({
        where: { itemId_promptId: { itemId, promptId } },
        update: { status: 'failed' },
        create: { itemId, promptId, status: 'failed' },
        include: { prompt: { select: { name: true, description: true } } },
      })
      return { ...row, promptName: row.prompt.name, promptDescription: row.prompt.description, prompt: undefined }
    }

    // Mark processing
    await db.researchSummary.upsert({
      where: { itemId_promptId: { itemId, promptId } },
      update: { status: 'processing' },
      create: { itemId, promptId, status: 'processing' },
    })

    try {
      const userPrompt = prompt.userPrompt.replace('{transcript}', item.transcript.slice(0, 12000))
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
