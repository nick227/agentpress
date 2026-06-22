import { db } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'

export class CommunityService {
  async listAgents(workspaceId?: string) {
    const items = await db.agent.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    if (!workspaceId || items.length === 0) return items.map(a => ({ ...a, forked: false }))
    const forkedSet = new Set(
      (await db.agent.findMany({
        where: { workspaceId, sourceAgentId: { in: items.map(a => a.id) } },
        select: { sourceAgentId: true },
      })).map(a => a.sourceAgentId!)
    )
    return items.map(a => ({ ...a, forked: forkedSet.has(a.id) }))
  }

  async listPipelines(workspaceId?: string) {
    const items = await db.pipeline.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, slug: true, description: true, category: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        _count: { select: { agents: true, variables: true, forks: true } },
      },
    })
    if (!workspaceId || items.length === 0) return items.map(p => ({ ...p, forked: false }))
    const forkedSet = new Set(
      (await db.pipeline.findMany({
        where: { workspaceId, sourcePipelineId: { in: items.map(p => p.id) } },
        select: { sourcePipelineId: true },
      })).map(p => p.sourcePipelineId!)
    )
    return items.map(p => ({ ...p, forked: forkedSet.has(p.id) }))
  }

  async listFeeds(workspaceId?: string) {
    const items = await db.researchSource.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, slug: true, category: true, sourceType: true, sourceUrl: true,
        status: true, lastChecked: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        _count: { select: { items: true } },
      },
    })
    if (!workspaceId || items.length === 0) return items.map(f => ({ ...f, forked: false }))
    const feedUrls = items.map(f => f.sourceUrl).filter((u): u is string => !!u)
    const forkedUrls = new Set(
      (await db.researchSource.findMany({
        where: { workspaceId, sourceUrl: { in: feedUrls } },
        select: { sourceUrl: true },
      })).map(f => f.sourceUrl!)
    )
    return items.map(f => ({ ...f, forked: f.sourceUrl ? forkedUrls.has(f.sourceUrl) : false }))
  }

  async listPrompts(workspaceId?: string) {
    const items = await db.prompt.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { name: 'asc' },
      select: {
        id: true, key: true, name: true, description: true, kind: true, category: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
      },
    })
    if (!workspaceId || items.length === 0) return items.map(p => ({ ...p, forked: false }))
    const forkedSet = new Set(
      (await db.prompt.findMany({
        where: { workspaceId, sourcePromptId: { in: items.map(p => p.id) } },
        select: { sourcePromptId: true },
      })).map(p => p.sourcePromptId!)
    )
    return items.map(p => ({ ...p, forked: forkedSet.has(p.id) }))
  }

  async getPipeline(pipelineId: string) {
    const pipeline = await db.pipeline.findFirst({
      where: { id: pipelineId, visibility: 'PUBLIC' },
      select: {
        id: true, name: true, slug: true, description: true, category: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        variables: { orderBy: { sortOrder: 'asc' }, select: { key: true, label: true, type: true, required: true, defaultValue: true, exampleValue: true, sortOrder: true } },
        agents: { orderBy: { sortOrder: 'asc' }, select: { uid: true, kind: true, sourceAgentId: true, name: true, systemPrompt: true, userPrompt: true, outputTarget: true, outputFormat: true, imageMode: true, enabled: true, sortOrder: true } },
      },
    })
    if (!pipeline) throw Object.assign(new Error('Community pipeline not found'), { statusCode: 404 })
    return pipeline
  }

  async getFeed(sourceId: string) {
    const feed = await db.researchSource.findFirst({
      where: { id: sourceId, visibility: 'PUBLIC' },
      select: {
        id: true, name: true, slug: true, category: true, sourceType: true, sourceUrl: true, status: true, lastChecked: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        items: { orderBy: { publishedAt: 'desc' }, take: 20, select: { id: true, title: true, itemUrl: true, publishedAt: true, contentStatus: true } },
      },
    })
    if (!feed) throw Object.assign(new Error('Community feed not found'), { statusCode: 404 })
    return feed
  }

  async getPrompt(promptId: string) {
    const prompt = await db.prompt.findFirst({
      where: { id: promptId, visibility: 'PUBLIC' },
    })
    if (!prompt) throw Object.assign(new Error('Community prompt not found'), { statusCode: 404 })
    return prompt
  }

  async forkPipeline(context: AuthContext, pipelineId: string, name?: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.pipeline.findFirst({
      where: { id: pipelineId, visibility: 'PUBLIC' },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!source) throw Object.assign(new Error('Community pipeline not found'), { statusCode: 404 })

    const base = `${source.slug}-copy`
    let slug = base
    let suffix = 2
    while (await db.pipeline.findFirst({ where: { workspaceId: context.workspaceId, slug } })) slug = `${base}-${suffix++}`

    return db.pipeline.create({
      data: {
        name: name?.trim() || `${source.name} Copy`,
        slug,
        description: source.description,
        category: source.category,
        status: 'draft',
        dryRun: true,
        bodyComposer: source.bodyComposer ?? undefined,
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        visibility: 'PRIVATE',
        sourcePipelineId: source.id,
        sourceVersionAt: source.updatedAt,
        forkedAt: new Date(),
        variables: {
          create: source.variables.map(({ key, label, type, required, defaultValue, exampleValue, sortOrder }) => ({
            key, label, type, required, defaultValue, exampleValue, sortOrder,
          })),
        },
        agents: {
          create: source.agents.map(({ uid, kind, sourceAgentId, name, systemPrompt, userPrompt, outputTarget, outputFormat, imageMode, enabled, sortOrder }) => ({
            uid, kind, sourceAgentId, name, systemPrompt, userPrompt, outputTarget, outputFormat, imageMode, enabled, sortOrder,
          })),
        },
      },
    })
  }

  async forkFeed(context: AuthContext, sourceId: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.researchSource.findFirst({ where: { id: sourceId, visibility: 'PUBLIC' } })
    if (!source) throw Object.assign(new Error('Community feed not found'), { statusCode: 404 })

    const existing = await db.researchSource.findFirst({
      where: { workspaceId: context.workspaceId, sourceUrl: source.sourceUrl },
    })
    if (existing) return existing

    let slug = source.slug
    let suffix = 2
    while (await db.researchSource.findFirst({ where: { workspaceId: context.workspaceId, slug } })) slug = `${source.slug}-${suffix++}`

    return db.researchSource.create({
      data: {
        name: source.name,
        slug,
        category: source.category,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        externalId: source.externalId,
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        visibility: 'PRIVATE',
      },
    })
  }

  async forkPrompt(context: AuthContext, promptId: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.prompt.findFirst({ where: { id: promptId, visibility: 'PUBLIC' } })
    if (!source) throw Object.assign(new Error('Community prompt not found'), { statusCode: 404 })
    const key = source.key ?? source.slug

    const existing = await db.prompt.findFirst({
      where: { workspaceId: context.workspaceId, key },
    })
    if (existing) return existing

    return db.prompt.create({
      data: {
        name: source.name,
        slug: source.slug,
        key,
        description: source.description,
        kind: source.kind,
        category: source.category,
        tags: source.tags ?? [],
        systemPrompt: source.systemPrompt,
        userPrompt: source.userPrompt,
        uid: source.uid,
        outputTarget: source.outputTarget,
        outputFormat: source.outputFormat,
        promptHash: source.promptHash,
        workspaceId: context.workspaceId,
        visibility: 'PRIVATE',
        sourcePromptId: source.id,
      },
    })
  }
}
