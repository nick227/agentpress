import { db, Prisma } from '@project/db'
import { parseCategoryIds } from './serviceUtils'
import { authorization, type AuthContext } from './AuthorizationService'
import { audit } from './AuditService'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function assertPublicPromptsSafe(agents: Array<{ systemPrompt?: string; userPrompt?: string }>) {
  const secretPattern = /(?:sk-[a-z0-9_-]{16,}|(?:api[_ -]?key|password|secret|token)\s*[:=]\s*[^\s{][^\s]{5,})/i
  if (agents.some((agent) => secretPattern.test(`${agent.systemPrompt ?? ''}\n${agent.userPrompt ?? ''}`))) {
    throw Object.assign(new Error('Remove embedded credentials before making this pipeline public'), { statusCode: 400 })
  }
}

async function uniqueSlug(base: string, workspaceId: string): Promise<string> {
  let slug = base
  let suffix = 0
  while (true) {
    const existing = await db.pipeline.findFirst({ where: { slug, workspaceId } })
    if (!existing) return slug
    suffix++
    slug = `${base}-${suffix}`
  }
}

function formatPipeline(p: any) {
  const wpCategoryIds = parseCategoryIds(p.wpCategoryIds)
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? undefined,
    category: p.category ?? undefined,
    status: p.status,
    visibility: p.visibility,
    destinationId: p.destinationId ?? undefined,
    wpCategoryIds: wpCategoryIds.length > 0 ? wpCategoryIds : undefined,
    bodyComposer: p.bodyComposer ?? undefined,
    dryRun: p.dryRun,
    variables: (p.variables ?? []).map((v: any) => ({
      id: v.id,
      pipelineId: v.pipelineId,
      key: v.key,
      label: v.label ?? undefined,
      type: v.type,
      required: v.required,
      defaultValue: v.defaultValue ?? undefined,
      exampleValue: v.exampleValue ?? undefined,
      sortOrder: v.sortOrder,
    })),
    agents: (p.agents ?? []).map((a: any) => ({
      id: a.id,
      pipelineId: a.pipelineId,
      uid: a.uid,
      name: a.name,
      systemPrompt: a.systemPrompt,
      userPrompt: a.userPrompt,
      outputTarget: a.outputTarget,
      outputFormat: a.outputFormat,
      imageMode: a.imageMode,
      selectedImageAssetId: a.selectedImageAssetId ?? undefined,
      enabled: a.enabled,
      sortOrder: a.sortOrder,
    })),
    loop: p.loop ? {
      id: p.loop.id,
      pipelineId: p.loop.pipelineId,
      loopType: p.loop.loopType,
      sourceId: p.loop.sourceId ?? undefined,
      sourceName: (p.loop as any).source?.name ?? undefined,
      cursorMode: p.loop.cursorMode,
      cursorAt: p.loop.cursorAt ?? undefined,
      dateRangeStart: p.loop.dateRangeStart ?? undefined,
      dateRangeEnd: p.loop.dateRangeEnd ?? undefined,
      variableMap: p.loop.variableMap ?? undefined,
      dataset: p.loop.datasetConfig ? {
        sourceType: (p.loop.datasetConfig as any).sourceType,
        name: (p.loop.datasetConfig as any).name,
        url: (p.loop.datasetConfig as any).url ?? undefined,
        headers: (p.loop.datasetConfig as any).headers ?? [],
        rowCount: Array.isArray((p.loop.datasetConfig as any).rows) ? (p.loop.datasetConfig as any).rows.length : 0,
      } : undefined,
      maxBatchSize: p.loop.maxBatchSize,
      createdAt: p.loop.createdAt,
      updatedAt: p.loop.updatedAt,
    } : undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export class PipelineService {
  private async resolveId(context: AuthContext, idOrSlug: string): Promise<string> {
    const p = await db.pipeline.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, workspaceId: true },
    })
    if (!p) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    return p.id
  }

  async list(context: AuthContext) {
    const pipelines = await db.pipeline.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { agents: true } },
        runs: { select: { startedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    })

    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? undefined,
      status: p.status,
      agentCount: p._count.agents,
      lastRunAt: p.runs[0]?.startedAt ?? undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  }

  async get(context: AuthContext, pipelineId: string) {
    const p = await db.pipeline.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ id: pipelineId }, { slug: pipelineId }] },

      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
        runs: { orderBy: { startedAt: 'desc' }, take: 10 },
        loop: { include: { source: { select: { name: true } } } },
      },
    })
    if (!p) return null

    return {
      data: formatPipeline(p),
      recentRuns: p.runs.map((r) => ({
        id: r.id,
        pipelineId: r.pipelineId,
        title: r.title ?? undefined,
        status: r.status,
        dryRun: r.dryRun,
        variables: r.variables,
        generatedPost: r.generatedPost ?? undefined,
        outputFolder: r.outputFolder ?? undefined,
        destinationId: r.destinationId ?? undefined,
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? undefined,
        error: r.error ?? undefined,
      })),
    }
  }

  async create(context: AuthContext, data: { name: string; description?: string; category?: string; visibility?: 'PRIVATE' | 'PUBLIC' }) {
    authorization.authorize(context, 'resource:edit')
    if (data.visibility === 'PUBLIC') authorization.authorize(context, 'resource:visibility')
    const slug = await uniqueSlug(toSlug(data.name), context.workspaceId)
    const p = await db.pipeline.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        category: data.category,
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        visibility: data.visibility ?? 'PRIVATE',
      },
      include: {
        variables: true,
        agents: true,
      },
    })
    return formatPipeline(p)
  }

  async update(context: AuthContext, idOrSlug: string, data: any) {
    authorization.authorize(context, 'resource:edit')
    const pipelineId = await this.resolveId(context, idOrSlug)
    const { variables, agents, ...fields } = data
    const current = await db.pipeline.findUniqueOrThrow({ where: { id: pipelineId }, include: { agents: true } })

    if ('wpCategoryIds' in fields) {
      fields.wpCategoryIds = fields.wpCategoryIds?.length
        ? fields.wpCategoryIds
        : Prisma.DbNull
    }
    delete fields.workspaceId
    delete fields.createdByUserId
    if ('visibility' in fields) {
      authorization.authorize(context, 'resource:visibility')
      if (fields.visibility === 'PUBLIC') fields.destinationId = null
    }
    if (fields.visibility === 'PUBLIC' || (current.visibility === 'PUBLIC' && fields.visibility !== 'PRIVATE')) {
      assertPublicPromptsSafe(agents ?? current.agents)
      fields.destinationId = null
    }
    if (fields.destinationId) {
      const destination = await db.destination.findFirst({ where: { id: fields.destinationId, workspaceId: context.workspaceId } })
      if (!destination) throw Object.assign(new Error('Destination not found'), { statusCode: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.pipeline.update({ where: { id: pipelineId }, data: fields })

      if (variables !== undefined) {
        await tx.pipelineVariable.deleteMany({ where: { pipelineId } })
        if (variables.length > 0) {
          await tx.pipelineVariable.createMany({
            data: variables.map((v: any) => ({
              pipelineId,
              key: v.key,
              label: v.label,
              type: v.type,
              required: v.required ?? false,
              defaultValue: v.defaultValue?.toString(),
              exampleValue: v.exampleValue?.toString(),
              sortOrder: v.sortOrder ?? 0,
            })),
          })
        }
      }

      if (agents !== undefined) {
        await tx.pipelineAgent.deleteMany({ where: { pipelineId } })
        if (agents.length > 0) {
          await tx.pipelineAgent.createMany({
            data: agents.map((a: any) => ({
              pipelineId,
              uid: a.uid,
              name: a.name,
              systemPrompt: a.systemPrompt,
              userPrompt: a.userPrompt,
              outputTarget: a.outputTarget,
              outputFormat: a.outputFormat ?? 'text',
              imageMode: a.imageMode ?? 'generate',
              selectedImageAssetId: a.selectedImageAssetId ?? null,
              enabled: a.enabled ?? true,
              sortOrder: a.sortOrder ?? 0,
            })),
          })
        }
      }
    })

    const updated = await db.pipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if ('visibility' in fields && fields.visibility !== current.visibility) {
      await audit.record({ workspaceId: context.workspaceId, actorUserId: context.userId, action: 'pipeline.visibility_changed', targetType: 'pipeline', targetId: pipelineId, metadata: { from: current.visibility, to: fields.visibility } })
    }
    return formatPipeline(updated)
  }

  async delete(context: AuthContext, idOrSlug: string) {
    authorization.authorize(context, 'resource:delete')
    const pipelineId = await this.resolveId(context, idOrSlug)
    await db.$transaction(async (tx) => {
      // PipelineRun's database constraint may predate the cascade relation in the
      // Prisma schema, so remove run history explicitly before the pipeline.
      // Agent runs, run assets, and publish attempts cascade from PipelineRun.
      await tx.pipelineRun.deleteMany({ where: { pipelineId } })
      await tx.pipeline.delete({ where: { id: pipelineId } })
    })
  }

  async validate(context: AuthContext, idOrSlug: string) {
    const pipelineId = await this.resolveId(context, idOrSlug)
    const p = await db.pipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      include: {
        variables: true,
        agents: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const errors: { level: 'error' | 'warning'; message: string; path?: string }[] = []
    const warnings: { level: 'error' | 'warning'; message: string; path?: string }[] = []

    if (p.agents.length === 0) {
      errors.push({ level: 'error', message: 'Pipeline has no agents' })
    }

    const uids = p.agents.map((a) => a.uid)
    const dupeUids = uids.filter((u, i) => uids.indexOf(u) !== i)
    dupeUids.forEach((u) => errors.push({ level: 'error', message: `Duplicate agent UID: ${u}`, path: `agents.${u}` }))

    const varKeys = new Set(p.variables.map((v) => v.key))
    const agentUidSet = new Set(uids)
    const researchSources = await db.researchSource.findMany({
      where: { workspaceId: context.workspaceId },
      select: { slug: true },
    })
    const researchSourceSlugs = new Set(researchSources.map((source) => source.slug))

    for (const agent of p.agents) {
      const refs = [...agent.systemPrompt.matchAll(/\{([^}]+)\}/g), ...agent.userPrompt.matchAll(/\{([^}]+)\}/g)]
      for (const [, ref] of refs) {
        if (!ref) continue
        if (ref.startsWith('agents.')) {
          const parts = ref.split('.')
          const uid = parts[1]
          if (uid && !agentUidSet.has(uid)) {
            warnings.push({ level: 'warning', message: `Agent "${agent.uid}" references unknown agent UID "${uid}"`, path: `agents.${agent.uid}` })
          }
        } else if (ref === 'research' || ref.startsWith('research.')) {
          warnings.push({ level: 'warning', message: `Agent "${agent.uid}" uses legacy {research} reference which is deprecated. Use the specific feed slug instead, e.g. {feed_slug.summary}`, path: `agents.${agent.uid}` })
        } else if (ref.includes('.')) {
          const [root] = ref.split('.')
          if (root && root !== 'row' && !varKeys.has(root) && !researchSourceSlugs.has(root)) {
            warnings.push({ level: 'warning', message: `Agent "${agent.uid}" references unknown variable or research source "${root}"`, path: `agents.${agent.uid}` })
          }
        } else if (!varKeys.has(ref)) {
          warnings.push({ level: 'warning', message: `Agent "${agent.uid}" references unknown variable "${ref}"`, path: `agents.${agent.uid}` })
        }
      }
    }

    const requiredVars = p.variables.filter((v) => v.required && !v.defaultValue)
    if (requiredVars.length > 0 && p.agents.length > 0) {
      warnings.push({
        level: 'warning',
        message: `${requiredVars.length} required variable(s) have no default value — must be provided at runtime`,
      })
    }

    return { valid: errors.length === 0, errors, warnings }
  }
}
