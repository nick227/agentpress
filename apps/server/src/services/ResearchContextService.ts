import { db } from '@project/db'
import { ResearchService } from './ResearchService'
import { resolvePipelineSummaryPrompt } from './summaryPromptResolve'
import { getCommunityWorkspaceId } from './communityWorkspace'

export interface ResearchContext {
  sourceId: string
  sourceSlug: string
  sourceName: string
  sourceType: string
  itemId: string
  title: string
  url: string
  date: string
  publishedAt: string
  summaryPromptId: string
  summaryPromptName: string
  summary: string
  content: string
}

type PipelineForResearch = {
  workspaceId?: string
  variables?: Array<{ key: string }>
  agents?: Array<{ uid: string; systemPrompt: string; userPrompt: string }>
}

const RESEARCH_FIELDS = new Set(['summary', 'date', 'publishedAt', 'title', 'url', 'content', 'sourceName', 'sourceType'])
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export class ResearchContextService {
  private research = new ResearchService()

  async resolveForPipeline(
    pipeline: PipelineForResearch,
    itemOverridesBySourceId: Record<string, string> = {},
    dryRun = false,
  ): Promise<Record<string, ResearchContext>> {
    const contexts: Record<string, ResearchContext> = {}

    const referencedSources = this.findReferencedSources(pipeline)
    if (referencedSources.size > 0) {
      const communityWorkspaceId = await getCommunityWorkspaceId()
      const rawSources = await db.researchSource.findMany({
        where: {
          slug: { in: [...referencedSources.keys()] },
          OR: [
            ...(pipeline.workspaceId ? [{ workspaceId: pipeline.workspaceId }] : []),
            ...(communityWorkspaceId ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const }] : []),
          ],
        },
      })
      const sourceBySlug = new Map<string, typeof rawSources[0]>()
      for (const source of rawSources) {
        const isOwned = pipeline.workspaceId && source.workspaceId === pipeline.workspaceId
        const isCommunity = source.workspaceId === communityWorkspaceId
        if (isOwned || (isCommunity && !sourceBySlug.has(source.slug))) {
          sourceBySlug.set(source.slug, source)
        }
      }

      for (const [slug, itemKeys] of referencedSources) {
        const source = sourceBySlug.get(slug)
        if (!source) throw new Error(`Research source "${slug}" was not found in this workspace or the community library`)
        const sourceContext = contexts[slug] ?? await this.resolveSource(
          source,
          undefined,
          itemOverridesBySourceId[source.id],
          dryRun,
        )
        contexts[slug] = sourceContext

        for (const itemKey of itemKeys) {
          ;(sourceContext as unknown as Record<string, ResearchContext>)[itemKey] = await this.resolveSource(
            source,
            itemKey,
            undefined,
            dryRun,
          )
        }
      }
    }

    return contexts
  }

  private findReferencedSources(pipeline: PipelineForResearch): Map<string, Set<string>> {
    const agentUids = new Set((pipeline.agents ?? []).map((agent) => agent.uid))
    const references = new Map<string, Set<string>>()
    for (const agent of pipeline.agents ?? []) {
      const text = `${agent.systemPrompt}\n${agent.userPrompt}`
      for (const [, rawRef] of text.matchAll(/\{([^}]+)\}/g)) {
        if (!rawRef || !rawRef.includes('.')) continue
        const ref = rawRef.startsWith('agents.') ? rawRef.slice('agents.'.length) : rawRef
        const parts = ref.split('.')
        const [root, second, third] = parts
        if (!root || root === 'research' || root === 'row' || agentUids.has(root)) continue
        if (second && RESEARCH_FIELDS.has(second)) {
          if (!references.has(root)) references.set(root, new Set())
        } else if (second && third && DATE_KEY.test(second) && RESEARCH_FIELDS.has(third)) {
          if (!references.has(root)) references.set(root, new Set())
          references.get(root)!.add(second)
        }
      }
    }
    return references
  }

  private async resolveSource(source: {
    id: string
    slug: string
    name: string
    sourceType: string
    defaultSummaryPromptId?: string | null
  }, itemKey?: string, overrideItemId?: string, dryRun = false): Promise<ResearchContext> {
    let item = itemKey
      ? await this.findItemByKey(source.id, itemKey)
      : overrideItemId
        ? await db.researchItem.findFirst({ where: { id: overrideItemId, sourceId: source.id } })
        : await db.researchItem.findFirst({
            where: { sourceId: source.id },
            orderBy: { publishedAt: 'desc' },
          })

    if (!item) {
      if (dryRun) {
        await this.research.checkLatest(null, source.id).catch(() => null)
        item = itemKey
          ? await this.findItemByKey(source.id, itemKey)
          : await db.researchItem.findFirst({
              where: { sourceId: source.id },
              orderBy: { publishedAt: 'desc' },
            })
        if (!item) {
          return {
            sourceId: source.id,
            sourceSlug: source.slug,
            sourceName: source.name,
            sourceType: source.sourceType,
            itemId: '',
            title: `[No content yet — ${source.name}]`,
            url: '',
            date: new Date().toISOString().slice(0, 10),
            publishedAt: new Date().toISOString(),
            summaryPromptId: '',
            summaryPromptName: '',
            summary: `[No content available for ${source.name}]`,
            content: '',
          }
        }
      } else {
        throw new Error(itemKey
          ? `No research item found for "${source.name}" on ${itemKey}`
          : `No research items found for "${source.name}"`)
      }
    }

    const prompt = await resolvePipelineSummaryPrompt(source.defaultSummaryPromptId)

    let summary = await db.researchSummary.findUnique({
      where: { itemId_promptId: { itemId: item.id, promptId: prompt.id } },
    })

    if (!summary || summary.status !== 'done' || !summary.text) {
      summary = await this.research.summarize(null, item.id, prompt.id) as any
    }

    if (!summary?.text) {
      throw new Error(`Could not generate a research summary for "${item.title}"`)
    }

    return {
      sourceId: source.id,
      sourceSlug: source.slug,
      sourceName: source.name,
      sourceType: source.sourceType,
      itemId: item.id,
      title: item.title,
      url: item.itemUrl,
      date: item.publishedAt.toISOString().slice(0, 10),
      publishedAt: item.publishedAt.toISOString(),
      summaryPromptId: prompt.id,
      summaryPromptName: prompt.name,
      summary: summary.text,
      content: item.content ?? '',
    }
  }

  private async findItemByKey(sourceId: string, itemKey: string) {
    if (DATE_KEY.test(itemKey)) {
      const start = new Date(`${itemKey}T00:00:00.000Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 1)
      return db.researchItem.findFirst({
        where: { sourceId, publishedAt: { gte: start, lt: end } },
        orderBy: { publishedAt: 'desc' },
      })
    }

    return db.researchItem.findFirst({
      where: {
        sourceId,
        OR: [{ id: itemKey }, { externalId: itemKey }],
      },
      orderBy: { publishedAt: 'desc' },
    })
  }
}
