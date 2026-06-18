import { db, Prisma } from '@project/db'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(accountId: string, base: string): Promise<string> {
  let slug = base
  let suffix = 0
  while (true) {
    const existing = await db.pipeline.findUnique({ where: { accountId_slug: { accountId, slug } } })
    if (!existing) return slug
    suffix++
    slug = `${base}-${suffix}`
  }
}

function parseCategoryIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
}

function formatPipeline(p: any) {
  const wpCategoryIds = parseCategoryIds(p.wpCategoryIds)
  return {
    id: p.id,
    accountId: p.accountId,
    name: p.name,
    slug: p.slug,
    description: p.description ?? undefined,
    category: p.category ?? undefined,
    status: p.status,
    destinationId: p.destinationId ?? undefined,
    wpCategoryIds: wpCategoryIds.length > 0 ? wpCategoryIds : undefined,
    bodyComposer: p.bodyComposer ?? undefined,
    dryRun: p.dryRun,
    scheduleMode: p.scheduleMode,
    frequency: p.frequency ?? undefined,
    timeOfDay: p.timeOfDay ?? undefined,
    timezone: p.timezone ?? undefined,
    isPaused: p.isPaused,
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
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export class PipelineService {
  private async resolveId(idOrSlug: string): Promise<string> {
    const p = await db.pipeline.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    })
    if (!p) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    return p.id
  }

  async list(accountId: string) {
    const pipelines = await db.pipeline.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { agents: true } },
        runs: { select: { startedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    })

    return pipelines.map((p) => ({
      id: p.id,
      accountId: p.accountId,
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

  async get(pipelineId: string) {
    const p = await db.pipeline.findFirst({
      where: { OR: [{ id: pipelineId }, { slug: pipelineId }] },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
        runs: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    })
    if (!p) return null

    return {
      data: formatPipeline(p),
      recentRuns: p.runs.map((r) => ({
        id: r.id,
        accountId: r.accountId,
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

  async create(accountId: string, data: { name: string; description?: string; category?: string }) {
    const slug = await uniqueSlug(accountId, toSlug(data.name))
    const p = await db.pipeline.create({
      data: {
        accountId,
        name: data.name,
        slug,
        description: data.description,
        category: data.category,
      },
      include: {
        variables: true,
        agents: true,
      },
    })
    return formatPipeline(p)
  }

  async update(idOrSlug: string, data: any) {
    const pipelineId = await this.resolveId(idOrSlug)
    const { variables, agents, ...fields } = data

    if ('wpCategoryIds' in fields) {
      fields.wpCategoryIds = fields.wpCategoryIds?.length
        ? fields.wpCategoryIds
        : Prisma.DbNull
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
    return formatPipeline(updated)
  }

  async delete(idOrSlug: string) {
    const pipelineId = await this.resolveId(idOrSlug)
    await db.pipeline.delete({ where: { id: pipelineId } })
  }

  async validate(idOrSlug: string) {
    const pipelineId = await this.resolveId(idOrSlug)
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
      where: { accountId: p.accountId },
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
          if (root && !varKeys.has(root) && !researchSourceSlugs.has(root)) {
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
