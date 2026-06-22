import { createHash } from 'crypto'
import { db } from '@project/db'
import type { AgentKind } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'
import { getCommunityWorkspaceId } from './communityWorkspace'

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'agent'
}

function normalizeUid(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'agent'
}

function hashAgent(input: {
  kind: AgentKind
  systemPrompt: string
  userPrompt: string
  outputTarget: string
  outputFormat: string
}) {
  return createHash('sha256')
    .update([input.kind, input.systemPrompt, input.userPrompt, input.outputTarget, input.outputFormat].join('|||'))
    .digest('hex')
}

function formatAgent(agent: any) {
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    visibility: agent.visibility,
    key: agent.key,
    slug: agent.slug,
    name: agent.name,
    description: agent.description ?? undefined,
    category: agent.category,
    tags: (agent.tags as string[]) ?? [],
    kind: agent.kind,
    defaultUid: agent.defaultUid,
    systemPrompt: agent.systemPrompt,
    userPrompt: agent.userPrompt,
    outputTarget: agent.outputTarget,
    outputFormat: agent.outputFormat,
    sourceAgentId: agent.sourceAgentId ?? undefined,
    usageCount: agent.usageCount,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }
}

type AgentInput = {
  name: string
  key?: string
  description?: string
  category?: string
  tags?: string[]
  kind: AgentKind
  defaultUid: string
  systemPrompt: string
  userPrompt: string
  outputTarget: string
  outputFormat: string
  sourceAgentId?: string
}

export class AgentService {
  async list(context: AuthContext, filters?: {
    kind?: AgentKind
    category?: string
    search?: string
    resolved?: boolean | string
  }) {
    const resolved = filters?.resolved === true || filters?.resolved === 'true'
    const communityWorkspaceId = resolved ? await getCommunityWorkspaceId() : null
    const agents = await db.agent.findMany({
      where: {
        AND: [
          resolved
            ? {
                OR: [
                  { workspaceId: context.workspaceId },
                  ...(communityWorkspaceId
                    ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const }]
                    : []),
                ],
              }
            : { workspaceId: context.workspaceId },
          ...(filters?.kind ? [{ kind: filters.kind }] : []),
          ...(filters?.category ? [{ category: filters.category }] : []),
          ...(filters?.search ? [{ OR: [
            { name: { contains: filters.search } },
            { description: { contains: filters.search } },
            { category: { contains: filters.search } },
          ] }] : []),
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    if (!resolved) return agents.map(formatAgent)

    const byKey = new Map<string, ReturnType<typeof formatAgent>>()
    for (const agent of agents) {
      const current = byKey.get(agent.key)
      if (!current || agent.workspaceId === context.workspaceId) byKey.set(agent.key, formatAgent(agent))
    }
    return [...byKey.values()].sort((a, b) => {
      const ownership = Number(b.workspaceId === context.workspaceId) - Number(a.workspaceId === context.workspaceId)
      return ownership || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    })
  }

  async get(context: AuthContext, idOrSlug: string) {
    const communityWorkspaceId = await getCommunityWorkspaceId()
    const agent = await db.agent.findFirst({
      where: {
        OR: [
          { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
          ...(communityWorkspaceId ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }] : []),
        ],
      },
    })
    return agent ? formatAgent(agent) : null
  }

  private async uniqueSlug(workspaceId: string, name: string, excludeId?: string) {
    const base = slugify(name)
    let slug = base
    let suffix = 2
    while (await db.agent.findFirst({ where: { workspaceId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) {
      slug = `${base}-${suffix++}`
    }
    return slug
  }

  async create(context: AuthContext, input: AgentInput) {
    authorization.authorize(context, 'resource:edit')
    const source = input.sourceAgentId
      ? await db.agent.findFirst({ where: { id: input.sourceAgentId } })
      : null
    if (input.sourceAgentId && !source) throw Object.assign(new Error('Source Agent not found'), { statusCode: 404 })
    if (source) authorization.authorize(context, 'resource:read', source)

    const key = slugify(input.key ?? source?.key ?? input.name)
    const existing = await db.agent.findFirst({ where: { workspaceId: context.workspaceId, key } })
    if (existing) throw Object.assign(new Error(`An Agent with key "${key}" already exists`), { statusCode: 409 })
    const agentHash = hashAgent(input)
    const duplicate = await db.agent.findFirst({ where: { workspaceId: context.workspaceId, agentHash } })
    if (duplicate) throw Object.assign(new Error('An Agent with the same definition already exists'), { statusCode: 409 })

    const agent = await db.agent.create({
      data: {
        workspaceId: context.workspaceId,
        visibility: 'PRIVATE',
        key,
        slug: await this.uniqueSlug(context.workspaceId, input.name),
        name: input.name,
        description: input.description,
        category: input.category ?? 'general',
        tags: input.tags ?? [],
        kind: input.kind,
        defaultUid: normalizeUid(input.defaultUid),
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        outputTarget: input.outputTarget,
        outputFormat: input.outputFormat,
        sourceAgentId: source?.id,
        createdByUserId: context.userId,
        agentHash,
      },
    })
    return formatAgent(agent)
  }

  async update(context: AuthContext, idOrSlug: string, input: Partial<AgentInput>) {
    const existing = await db.agent.findFirst({ where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] } })
    if (!existing) throw Object.assign(new Error('Agent not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:edit', existing)
    const next = {
      kind: input.kind ?? existing.kind,
      systemPrompt: input.systemPrompt ?? existing.systemPrompt,
      userPrompt: input.userPrompt ?? existing.userPrompt,
      outputTarget: input.outputTarget ?? existing.outputTarget,
      outputFormat: input.outputFormat ?? existing.outputFormat,
    }
    const agent = await db.agent.update({
      where: { id: existing.id },
      data: {
        ...input,
        ...(input.name ? { slug: await this.uniqueSlug(context.workspaceId, input.name, existing.id) } : {}),
        ...(input.key ? { key: slugify(input.key) } : {}),
        ...(input.defaultUid ? { defaultUid: normalizeUid(input.defaultUid) } : {}),
        tags: input.tags ?? undefined,
        agentHash: hashAgent(next),
        sourceAgentId: undefined,
      },
    })
    return formatAgent(agent)
  }

  async delete(context: AuthContext, idOrSlug: string) {
    const existing = await db.agent.findFirst({ where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] } })
    if (!existing) throw Object.assign(new Error('Agent not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:delete', existing)
    await db.agent.delete({ where: { id: existing.id } })
  }

  async fork(context: AuthContext, agentId: string) {
    const source = await db.agent.findFirst({ where: { id: agentId, visibility: 'PUBLIC' } })
    if (!source) throw Object.assign(new Error('Community Agent not found'), { statusCode: 404 })
    const existing = await db.agent.findFirst({ where: { workspaceId: context.workspaceId, key: source.key } })
    if (existing) return formatAgent(existing)
    return this.create(context, {
      name: source.name,
      key: source.key,
      description: source.description ?? undefined,
      category: source.category,
      tags: source.tags as string[],
      kind: source.kind,
      defaultUid: source.defaultUid,
      systemPrompt: source.systemPrompt,
      userPrompt: source.userPrompt,
      outputTarget: source.outputTarget,
      outputFormat: source.outputFormat,
      sourceAgentId: source.id,
    })
  }
}
