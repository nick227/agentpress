import { db } from '@project/db'

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

function formatPipeline(p: any) {
  return {
    id: p.id,
    accountId: p.accountId,
    name: p.name,
    slug: p.slug,
    description: p.description ?? undefined,
    status: p.status,
    destinationId: p.destinationId ?? undefined,
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
      enabled: a.enabled,
      sortOrder: a.sortOrder,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export class PipelineService {
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

  async create(accountId: string, data: { name: string; description?: string }) {
    const slug = await uniqueSlug(accountId, toSlug(data.name))
    const p = await db.pipeline.create({
      data: {
        accountId,
        name: data.name,
        slug,
        description: data.description,
      },
      include: {
        variables: true,
        agents: true,
      },
    })
    return formatPipeline(p)
  }

  async update(pipelineId: string, data: any) {
    const { variables, agents, ...fields } = data

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

  async delete(pipelineId: string) {
    await db.pipeline.delete({ where: { id: pipelineId } })
  }

  async validate(pipelineId: string) {
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
