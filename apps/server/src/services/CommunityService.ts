import { db } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'

export class CommunityService {
  async listPipelines() {
    return db.pipeline.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, slug: true, description: true, category: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        _count: { select: { agents: true, variables: true, forks: true } },
      },
    })
  }

  async listFeeds() {
    return db.researchSource.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, slug: true, category: true, sourceType: true, sourceUrl: true,
        status: true, lastChecked: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        _count: { select: { items: true, subscriptions: true } },
      },
    })
  }

  async getPipeline(pipelineId: string) {
    const pipeline = await db.pipeline.findFirst({
      where: { id: pipelineId, visibility: 'PUBLIC' },
      select: {
        id: true, name: true, slug: true, description: true, category: true, updatedAt: true,
        workspace: { select: { id: true, name: true, type: true } },
        variables: { orderBy: { sortOrder: 'asc' }, select: { key: true, label: true, type: true, required: true, defaultValue: true, exampleValue: true, sortOrder: true } },
        agents: { orderBy: { sortOrder: 'asc' }, select: { uid: true, name: true, systemPrompt: true, userPrompt: true, outputTarget: true, outputFormat: true, enabled: true, sortOrder: true } },
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

  async forkPipeline(context: AuthContext, pipelineId: string, name?: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.pipeline.findFirst({
      where: { id: pipelineId, visibility: 'PUBLIC' },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
        feedLinks: true,
      },
    })
    if (!source) throw Object.assign(new Error('Community pipeline not found'), { statusCode: 404 })

    const base = `${source.slug}-copy`
    let slug = base
    let suffix = 2
    while (await db.pipeline.findFirst({ where: { workspaceId: context.workspaceId, slug } })) slug = `${base}-${suffix++}`

    return db.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.create({
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
            create: source.agents.map(({ uid, name, systemPrompt, userPrompt, outputTarget, outputFormat, imageMode, enabled, sortOrder }) => ({
              uid, name, systemPrompt, userPrompt, outputTarget, outputFormat, imageMode, enabled, sortOrder,
            })),
          },
        },
      })
      const subscribed = await tx.workspaceFeedSubscription.findMany({
        where: { workspaceId: context.workspaceId, sourceId: { in: source.feedLinks.map((link) => link.sourceId) } },
      })
      if (subscribed.length > 0) {
        await tx.pipelineFeed.createMany({
          data: source.feedLinks
            .filter((link) => subscribed.some((item) => item.sourceId === link.sourceId))
            .map((link) => ({ pipelineId: pipeline.id, sourceId: link.sourceId, alias: link.alias })),
        })
      }
      return pipeline
    })
  }

  async subscribeFeed(context: AuthContext, sourceId: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.researchSource.findFirst({ where: { id: sourceId, visibility: 'PUBLIC' } })
    if (!source) throw Object.assign(new Error('Community feed not found'), { statusCode: 404 })
    return db.workspaceFeedSubscription.upsert({
      where: { workspaceId_sourceId: { workspaceId: context.workspaceId, sourceId } },
      update: {},
      create: { workspaceId: context.workspaceId, sourceId, createdByUserId: context.userId },
    })
  }
}
