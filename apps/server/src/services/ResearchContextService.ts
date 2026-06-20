import { db } from '@project/db'
import { ResearchService } from './ResearchService'
import { resolvePipelineSummaryPrompt } from './summaryPromptResolve'

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
  accountId: string
  variables?: Array<{ key: string }>
  agents?: Array<{ systemPrompt: string; userPrompt: string }>
}

const RESEARCH_FIELDS = new Set(['summary', 'date', 'publishedAt', 'title', 'url', 'content', 'sourceName', 'sourceType'])
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export class ResearchContextService {
  private research = new ResearchService()

  async resolveForPipeline(
    pipeline: PipelineForResearch,
    itemOverridesBySourceId: Record<string, string> = {},
  ): Promise<Record<string, ResearchContext>> {
    const contexts: Record<string, ResearchContext> = {}

    const referencedSources = this.findReferencedSources(pipeline)
    if (referencedSources.size > 0) {
      const sources = await db.researchSource.findMany({
        where: { accountId: pipeline.accountId, slug: { in: [...referencedSources.keys()] } },
      })
      const sourceBySlug = new Map(sources.map((source) => [source.slug, source]))

      for (const [slug, itemKeys] of referencedSources) {
        const source = sourceBySlug.get(slug)
        if (!source) throw new Error(`Research source "${slug}" was not found`)
        const sourceContext = contexts[slug] ?? await this.resolveSource(
          source,
          undefined,
          itemOverridesBySourceId[source.id],
        )
        contexts[slug] = sourceContext

        for (const itemKey of itemKeys) {
          ;(sourceContext as unknown as Record<string, ResearchContext>)[itemKey] = await this.resolveSource(
            source,
            itemKey,
          )
        }
      }
    }

    return contexts
  }

  private findReferencedSources(pipeline: PipelineForResearch): Map<string, Set<string>> {
    const references = new Map<string, Set<string>>()
    for (const agent of pipeline.agents ?? []) {
      const text = `${agent.systemPrompt}\n${agent.userPrompt}`
      for (const [, ref] of text.matchAll(/\{([^}]+)\}/g)) {
        if (!ref || !ref.includes('.')) continue
        const parts = ref.split('.')
        const [root, second, third] = parts
        if (!root || root === 'agents' || root === 'research') continue
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
  }, itemKey?: string, overrideItemId?: string): Promise<ResearchContext> {
    let item = itemKey
      ? await this.findItemByKey(source.id, itemKey)
      : overrideItemId
        ? await db.researchItem.findFirst({ where: { id: overrideItemId, sourceId: source.id } })
        : await db.researchItem.findFirst({
            where: { sourceId: source.id },
            orderBy: { publishedAt: 'desc' },
          })

    if (!item) {
      throw new Error(itemKey
        ? `No research item found for "${source.name}" on ${itemKey}`
        : `No research items found for "${source.name}"`)
    }

    const prompt = await resolvePipelineSummaryPrompt(source.defaultSummaryPromptId)

    let summary = await db.researchSummary.findUnique({
      where: { itemId_promptId: { itemId: item.id, promptId: prompt.id } },
    })

    if (!summary || summary.status !== 'done' || !summary.text) {
      summary = await this.research.summarize(item.id, prompt.id) as any
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
