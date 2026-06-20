import { db } from '@project/db'
import { ResearchService } from './ResearchService'
import { formatResearchCheckMessage } from './researchCheckMessage'
import { PipelineRunService } from './PipelineRunService'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let suffix = 0
  while (true) {
    const existing = await db.account.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    suffix++
    slug = `${base}-${suffix}`
  }
}

export class AccountService {
  async navigation() {
    const accounts = await db.account.findMany({
      orderBy: { name: 'asc' },
      include: {
        pipelines: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true, status: true },
        },
        schedules: {
          orderBy: { name: 'asc' },
          include: { executions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } },
        },
        researchSources: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true, status: true },
        },
        destinations: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, type: true },
        },
      },
    })
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      slug: account.slug,
      pipelines: account.pipelines,
      schedules: account.schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt ?? undefined,
        lastExecutionStatus: schedule.executions[0]?.status,
      })),
      researchSources: account.researchSources,
      destinations: account.destinations,
    }))
  }

  async list() {
    const accounts = await db.account.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { pipelines: true } },
        pipelines: {
          select: { runs: { select: { startedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    })

    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      category: a.category ?? undefined,
      phone: a.phone ?? undefined,
      email: a.email ?? undefined,
      description: a.description ?? undefined,
      pipelineCount: a._count.pipelines,
      lastRunAt: a.pipelines[0]?.runs[0]?.startedAt ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))
  }

  async get(accountId: string) {
    const a = await db.account.findFirst({ where: { OR: [{ id: accountId }, { slug: accountId }] } })
    if (!a) return null
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      category: a.category ?? undefined,
      phone: a.phone ?? undefined,
      email: a.email ?? undefined,
      description: a.description ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }
  }

  async create(data: { name: string; category?: string; phone?: string; email?: string; description?: string }) {
    const slug = await uniqueSlug(toSlug(data.name))
    return db.account.create({
      data: {
        name: data.name,
        slug,
        category: data.category,
        phone: data.phone,
        email: data.email,
        description: data.description,
      },
    })
  }

  async update(accountId: string, data: { name?: string; category?: string; phone?: string; email?: string; description?: string }) {
    return db.account.update({
      where: { id: accountId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    })
  }

  async delete(accountId: string) {
    await db.account.delete({ where: { id: accountId } })
  }

  async sync(accountId: string) {
    const research = new ResearchService()
    const runs = new PipelineRunService()

    // --- Research: check all active sources ---
    const sources = await db.researchSource.findMany({
      where: { accountId, status: 'active' },
    })

    const researchResults: Array<{ sourceName: string; sourceId: string; newItem: boolean; updatedCount?: number; itemTitle?: string; statusMessage?: string; error?: string }> = []

    for (const source of sources) {
      try {
        const result = await research.checkLatest(source.id)
        const statusMessage = formatResearchCheckMessage(source.sourceType, result)
        const transcriptFailed = source.sourceType === 'youtube' && result.latest && !result.latest.hasTranscript
        researchResults.push({
          sourceName: source.name,
          sourceId: source.id,
          newItem: result.newItem,
          updatedCount: result.updatedCount,
          itemTitle: result.latest?.title ?? (result.newItem && result.item ? (result.item as { title: string }).title : undefined),
          statusMessage,
          error: !result.checked ? statusMessage : transcriptFailed ? statusMessage : undefined,
        })
      } catch (err: any) {
        researchResults.push({ sourceName: source.name, sourceId: source.id, newItem: false, error: err.message ?? 'Unknown error' })
      }
    }

    // --- Pipelines: start all ready pipelines ---
    const pipelines = await db.pipeline.findMany({
      where: { accountId, status: { not: 'paused' } },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { where: { enabled: true } },
        runs: { where: { status: 'running' }, take: 1 },
      },
    })

    const pipelineResults: Array<{ pipelineName: string; pipelineId: string; status: 'started' | 'skipped'; runId?: string; reason?: string }> = []

    for (const pipeline of pipelines) {
      if (pipeline.agents.length === 0) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: 'No enabled agents' })
        continue
      }
      if (pipeline.runs.length > 0) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: 'Run already in progress' })
        continue
      }
      try {
        const defaultVars: Record<string, string> = {}
        for (const v of pipeline.variables) {
          defaultVars[v.key] = v.defaultValue ?? ''
        }
        const run = await runs.startRun(pipeline.id, defaultVars)
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'started', runId: run.id })
      } catch (err: any) {
        pipelineResults.push({ pipelineName: pipeline.name, pipelineId: pipeline.id, status: 'skipped', reason: err.message ?? 'Failed to start' })
      }
    }

    return {
      research: {
        checked: researchResults.length,
        newItems: researchResults.filter((r) => r.newItem).length,
        results: researchResults,
      },
      pipelines: {
        started: pipelineResults.filter((r) => r.status === 'started').length,
        skipped: pipelineResults.filter((r) => r.status === 'skipped').length,
        results: pipelineResults,
      },
    }
  }
}
