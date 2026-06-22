import { db } from '@project/db'
import type { AgentKind } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'
import { getCommunityWorkspaceId } from './communityWorkspace'

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'workflow'
}

function normalizeUid(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'node'
}

function formatNode(node: any) {
  return {
    id: node.id,
    workflowId: node.workflowId,
    uid: node.uid,
    kind: node.kind as AgentKind,
    name: node.name,
    description: node.description ?? undefined,
    systemPrompt: node.systemPrompt,
    userPrompt: node.userPrompt,
    outputTarget: node.outputTarget,
    outputFormat: node.outputFormat,
    imageMode: node.imageMode,
    enabled: node.enabled,
    sortOrder: node.sortOrder,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

function formatWorkflow(wf: any, includeNodes = true) {
  return {
    id: wf.id,
    workspaceId: wf.workspaceId,
    visibility: wf.visibility,
    key: wf.key,
    slug: wf.slug,
    name: wf.name,
    description: wf.description ?? undefined,
    category: wf.category,
    tags: (wf.tags as string[]) ?? [],
    sortOrder: wf.sortOrder,
    sourceWorkflowId: wf.sourceWorkflowId ?? undefined,
    forkedAt: wf.forkedAt ?? undefined,
    sourceVersionAt: wf.sourceVersionAt ?? undefined,
    usageCount: wf.usageCount,
    ...(includeNodes ? { nodes: (wf.nodes ?? []).map(formatNode) } : {}),
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  }
}

function formatSummary(wf: any, forkedSet?: Set<string>) {
  return {
    id: wf.id,
    workspaceId: wf.workspaceId,
    visibility: wf.visibility,
    key: wf.key,
    slug: wf.slug,
    name: wf.name,
    description: wf.description ?? undefined,
    category: wf.category,
    tags: (wf.tags as string[]) ?? [],
    sortOrder: wf.sortOrder,
    sourceWorkflowId: wf.sourceWorkflowId ?? undefined,
    usageCount: wf.usageCount,
    nodeCount: wf._count?.nodes ?? wf.nodes?.length ?? 0,
    ...(forkedSet !== undefined ? { forked: forkedSet.has(wf.id) } : {}),
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  }
}

const nodeSelect = {
  id: true, workflowId: true, uid: true, kind: true, name: true, description: true,
  systemPrompt: true, userPrompt: true, outputTarget: true, outputFormat: true,
  imageMode: true, enabled: true, sortOrder: true, createdAt: true, updatedAt: true,
}

type NodeInput = {
  uid: string
  kind?: AgentKind
  name: string
  description?: string
  systemPrompt: string
  userPrompt: string
  outputTarget: string
  outputFormat: string
  imageMode?: string
  enabled?: boolean
  sortOrder: number
}

type WorkflowInput = {
  name: string
  key?: string
  description?: string
  category?: string
  tags?: string[]
  sortOrder?: number
  sourceWorkflowId?: string
  nodes: NodeInput[]
}

export class WorkflowService {
  async list(context: AuthContext, filters?: {
    category?: string
    search?: string
    resolved?: boolean | string
  }) {
    const resolved = filters?.resolved === true || filters?.resolved === 'true'
    const communityWorkspaceId = resolved ? await getCommunityWorkspaceId() : null

    const workflows = await db.workflow.findMany({
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
          ...(filters?.category ? [{ category: filters.category }] : []),
          ...(filters?.search ? [{
            OR: [
              { name: { contains: filters.search } },
              { description: { contains: filters.search } },
              { category: { contains: filters.search } },
            ],
          }] : []),
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true, workspaceId: true, visibility: true, key: true, slug: true, name: true,
        description: true, category: true, tags: true, sortOrder: true,
        sourceWorkflowId: true, usageCount: true, createdAt: true, updatedAt: true,
        _count: { select: { nodes: true } },
      },
    })

    if (!resolved) return workflows.map(w => formatSummary(w))

    const byKey = new Map<string, ReturnType<typeof formatSummary>>()
    for (const wf of workflows) {
      const current = byKey.get(wf.key)
      if (!current || wf.workspaceId === context.workspaceId) byKey.set(wf.key, formatSummary(wf))
    }
    return [...byKey.values()].sort((a, b) => {
      const ownership = Number(b.workspaceId === context.workspaceId) - Number(a.workspaceId === context.workspaceId)
      return ownership || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    })
  }

  async get(context: AuthContext, idOrSlug: string) {
    const communityWorkspaceId = await getCommunityWorkspaceId()
    const wf = await db.workflow.findFirst({
      where: {
        OR: [
          { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
          ...(communityWorkspaceId
            ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }]
            : []),
        ],
      },
      include: { nodes: { orderBy: { sortOrder: 'asc' }, select: nodeSelect } },
    })
    return wf ? formatWorkflow(wf) : null
  }

  private async uniqueSlug(workspaceId: string, name: string, excludeId?: string) {
    const base = slugify(name)
    let slug = base
    let suffix = 2
    while (await db.workflow.findFirst({
      where: { workspaceId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })) {
      slug = `${base}-${suffix++}`
    }
    return slug
  }

  async create(context: AuthContext, input: WorkflowInput) {
    authorization.authorize(context, 'resource:edit')

    const source = input.sourceWorkflowId
      ? await db.workflow.findFirst({ where: { id: input.sourceWorkflowId } })
      : null
    if (input.sourceWorkflowId && !source) {
      throw Object.assign(new Error('Source Workflow not found'), { statusCode: 404 })
    }
    if (source) authorization.authorize(context, 'resource:read', source)

    const key = slugify(input.key ?? source?.key ?? input.name)
    const existing = await db.workflow.findFirst({ where: { workspaceId: context.workspaceId, key } })
    if (existing) {
      throw Object.assign(new Error(`A Workflow with key "${key}" already exists`), { statusCode: 409 })
    }

    const wf = await db.workflow.create({
      data: {
        workspaceId: context.workspaceId,
        visibility: 'PRIVATE',
        key,
        slug: await this.uniqueSlug(context.workspaceId, input.name),
        name: input.name,
        description: input.description,
        category: input.category ?? 'general',
        tags: input.tags ?? [],
        sortOrder: input.sortOrder ?? 0,
        sourceWorkflowId: source?.id,
        forkedAt: source ? new Date() : undefined,
        sourceVersionAt: source?.updatedAt,
        createdByUserId: context.userId,
        nodes: {
          create: input.nodes.map(n => ({
            uid: normalizeUid(n.uid),
            kind: n.kind ?? 'AI_TEXT',
            name: n.name,
            description: n.description,
            systemPrompt: n.systemPrompt,
            userPrompt: n.userPrompt,
            outputTarget: n.outputTarget,
            outputFormat: n.outputFormat,
            imageMode: n.imageMode ?? 'generate',
            enabled: n.enabled ?? true,
            sortOrder: n.sortOrder,
          })),
        },
      },
      include: { nodes: { orderBy: { sortOrder: 'asc' }, select: nodeSelect } },
    })
    return formatWorkflow(wf)
  }

  async update(context: AuthContext, idOrSlug: string, input: Partial<WorkflowInput>) {
    const existing = await db.workflow.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!existing) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:edit', existing)

    if (input.key) {
      const keyConflict = await db.workflow.findFirst({
        where: { workspaceId: context.workspaceId, key: slugify(input.key), NOT: { id: existing.id } },
      })
      if (keyConflict) throw Object.assign(new Error(`A Workflow with key "${slugify(input.key)}" already exists`), { statusCode: 409 })
    }

    const wf = await db.$transaction(async tx => {
      if (input.nodes !== undefined) {
        await tx.workflowNode.deleteMany({ where: { workflowId: existing.id } })
        await tx.workflowNode.createMany({
          data: input.nodes.map(n => ({
            workflowId: existing.id,
            uid: normalizeUid(n.uid),
            kind: n.kind ?? 'AI_TEXT',
            name: n.name,
            description: n.description,
            systemPrompt: n.systemPrompt,
            userPrompt: n.userPrompt,
            outputTarget: n.outputTarget,
            outputFormat: n.outputFormat,
            imageMode: n.imageMode ?? 'generate',
            enabled: n.enabled ?? true,
            sortOrder: n.sortOrder,
          })),
        })
      }
      return tx.workflow.update({
        where: { id: existing.id },
        data: {
          ...(input.name ? { name: input.name, slug: await this.uniqueSlug(context.workspaceId, input.name, existing.id) } : {}),
          ...(input.key ? { key: slugify(input.key) } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
        include: { nodes: { orderBy: { sortOrder: 'asc' }, select: nodeSelect } },
      })
    })
    return formatWorkflow(wf)
  }

  async delete(context: AuthContext, idOrSlug: string) {
    const existing = await db.workflow.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    })
    if (!existing) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:delete', existing)
    await db.workflow.delete({ where: { id: existing.id } })
  }

  async fork(context: AuthContext, workflowId: string, name?: string) {
    authorization.authorize(context, 'resource:edit')
    const source = await db.workflow.findFirst({
      where: { id: workflowId, visibility: 'PUBLIC' },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!source) throw Object.assign(new Error('Community Workflow not found'), { statusCode: 404 })

    const existing = await db.workflow.findFirst({
      where: { workspaceId: context.workspaceId, key: source.key },
      include: { nodes: { orderBy: { sortOrder: 'asc' }, select: nodeSelect } },
    })
    if (existing) return formatWorkflow(existing)

    return this.create(context, {
      name: name?.trim() || source.name,
      key: source.key,
      description: source.description ?? undefined,
      category: source.category,
      tags: source.tags as string[],
      sortOrder: source.sortOrder,
      sourceWorkflowId: source.id,
      nodes: source.nodes.map(n => ({
        uid: n.uid,
        kind: n.kind as AgentKind,
        name: n.name,
        description: n.description ?? undefined,
        systemPrompt: n.systemPrompt,
        userPrompt: n.userPrompt,
        outputTarget: n.outputTarget,
        outputFormat: n.outputFormat,
        imageMode: n.imageMode,
        enabled: n.enabled,
        sortOrder: n.sortOrder,
      })),
    })
  }

  async insertIntoPipeline(
    context: AuthContext,
    workflowId: string,
    pipelineId: string,
    insertAfterSortOrder?: number,
  ) {
    authorization.authorize(context, 'resource:edit')

    // Resolve workflow — workspace-owned wins over community
    const communityWorkspaceId = await getCommunityWorkspaceId()
    const wf = await db.workflow.findFirst({
      where: {
        id: workflowId,
        OR: [
          { workspaceId: context.workspaceId },
          ...(communityWorkspaceId ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const }] : []),
        ],
      },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!wf) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 })

    // Verify pipeline ownership
    const pipeline = await db.pipeline.findFirst({
      where: { id: pipelineId, workspaceId: context.workspaceId },
      include: { agents: { orderBy: { sortOrder: 'asc' }, select: { uid: true, sortOrder: true } } },
    })
    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })

    const insertAfter = insertAfterSortOrder ?? Math.max(...pipeline.agents.map(a => a.sortOrder), -1)
    const existingUids = new Set(pipeline.agents.map(a => a.uid))

    // Make uids unique within the pipeline — appending numeric suffix if needed
    function uniqueUid(base: string): string {
      if (!existingUids.has(base)) { existingUids.add(base); return base }
      let i = 2
      while (existingUids.has(`${base}_${i}`)) i++
      const result = `${base}_${i}`
      existingUids.add(result)
      return result
    }

    // Shift existing agents that come after the insertion point
    const agentsToShift = pipeline.agents.filter(a => a.sortOrder > insertAfter)
    const shiftBy = wf.nodes.length
    if (agentsToShift.length > 0) {
      await Promise.all(agentsToShift.map(a =>
        db.pipelineAgent.updateMany({
          where: { pipelineId: pipeline.id, uid: a.uid },
          data: { sortOrder: a.sortOrder + shiftBy },
        })
      ))
    }

    // Copy workflow nodes as pipeline agents (snapshot — no live dependency except provenance)
    await db.pipelineAgent.createMany({
      data: wf.nodes.map((node, i) => ({
        pipelineId: pipeline.id,
        uid: uniqueUid(node.uid),
        kind: node.kind,
        name: node.name,
        systemPrompt: node.systemPrompt,
        userPrompt: node.userPrompt,
        outputTarget: node.outputTarget,
        outputFormat: node.outputFormat,
        imageMode: node.imageMode,
        enabled: node.enabled,
        sortOrder: insertAfter + 1 + i,
        sourceWorkflowNodeId: node.id,
      })),
    })

    await db.workflow.update({ where: { id: wf.id }, data: { usageCount: { increment: 1 } } })

    const updated = await db.pipeline.findUnique({
      where: { id: pipeline.id },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' } },
        loop: true,
      },
    })
    return updated
  }
}
