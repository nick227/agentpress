import { createHash } from 'crypto'
import { db } from '@project/db'
import type { PromptKind, Visibility } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'
import { getCommunityWorkspaceId } from './communityWorkspace'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'prompt'
}

function promptHash(
  systemPrompt: string,
  userPrompt: string,
  outputTarget: string | null | undefined,
  kind: PromptKind,
): string {
  return createHash('sha256')
    .update(`${kind}|||${systemPrompt}|||${userPrompt}|||${outputTarget ?? ''}`)
    .digest('hex')
}

function formatPrompt(p: {
  id: string
  slug: string
  key: string | null
  name: string
  description: string | null
  kind: PromptKind
  category: string
  tags: unknown
  systemPrompt: string
  userPrompt: string
  uid: string | null
  outputTarget: string | null
  outputFormat: string | null
  visibility: Visibility
  workspaceId: string | null
  sourcePromptId: string | null
  promptHash: string
  usageCount: number
  sortOrder: number
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: p.id,
    slug: p.slug,
    key: p.key ?? p.slug,
    name: p.name,
    description: p.description ?? undefined,
    kind: p.kind,
    category: p.category,
    tags: (p.tags as string[]) ?? [],
    systemPrompt: p.systemPrompt,
    userPrompt: p.userPrompt,
    uid: p.uid ?? undefined,
    outputTarget: p.outputTarget ?? undefined,
    outputFormat: p.outputFormat ?? undefined,
    visibility: p.visibility,
    workspaceId: p.workspaceId ?? undefined,
    sourcePromptId: p.sourcePromptId ?? undefined,
    promptHash: p.promptHash,
    usageCount: p.usageCount,
    sortOrder: p.sortOrder,
    isDefault: p.isDefault,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

async function uniqueSlug(base: string, workspaceId: string, excludeId?: string): Promise<string> {
  let slug = slugify(base)
  let suffix = 0
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`
    const existing = await db.prompt.findFirst({
      where: { workspaceId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })
    if (!existing) return candidate
    suffix += 1
  }
}

async function clearContentDefaults(workspaceId: string, excludeId?: string) {
  await db.prompt.updateMany({
    where: {
      workspaceId,
      kind: 'CONTENT',
      isDefault: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { isDefault: false },
  })
}

export class PromptService {
  private listWhere(context: AuthContext) {
    return { workspaceId: context.workspaceId }
  }

  async list(context: AuthContext, filters?: {
    kind?: PromptKind
    category?: string
    search?: string
    resolved?: boolean | string
  }) {
    const includeCommunity = filters?.resolved === true || filters?.resolved === 'true'
    const communityWorkspaceId = includeCommunity ? await getCommunityWorkspaceId() : null
    const prompts = await db.prompt.findMany({
      where: {
        AND: [
          includeCommunity
            ? {
                OR: [
                  this.listWhere(context),
                  ...(communityWorkspaceId
                    ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const }]
                    : []),
                ],
              }
            : this.listWhere(context),
          ...(filters?.kind ? [{ kind: filters.kind }] : []),
          ...(filters?.category ? [{ category: filters.category }] : []),
          ...(filters?.search
            ? [{
                OR: [
                  { name: { contains: filters.search } },
                  { description: { contains: filters.search } },
                  { category: { contains: filters.search } },
                ],
              }]
            : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    })
    if (!includeCommunity) return prompts.map(formatPrompt)

    const communityKeysByLegacyIdentity = new Map<string, string>()
    for (const prompt of prompts) {
      if (prompt.workspaceId === communityWorkspaceId) {
        communityKeysByLegacyIdentity.set(`${prompt.kind}:${prompt.name}`, prompt.key ?? prompt.slug)
      }
    }

    const resolved = new Map<string, ReturnType<typeof formatPrompt>>()
    for (const prompt of prompts) {
      const formatted = formatPrompt(prompt)
      const key = prompt.key
        ?? (prompt.workspaceId === context.workspaceId
          ? communityKeysByLegacyIdentity.get(`${prompt.kind}:${prompt.name}`)
          : undefined)
        ?? prompt.slug
      const current = resolved.get(key)
      if (!current || prompt.workspaceId === context.workspaceId) {
        resolved.set(key, { ...formatted, key })
      }
    }
    return [...resolved.values()].sort((a, b) => {
      const ownershipOrder = Number(b.workspaceId === context.workspaceId) - Number(a.workspaceId === context.workspaceId)
      return ownershipOrder
        || a.sortOrder - b.sortOrder
        || a.category.localeCompare(b.category)
        || a.name.localeCompare(b.name)
    })
  }

  async get(context: AuthContext, promptIdOrSlug: string) {
    const communityWorkspaceId = await getCommunityWorkspaceId()
    const prompt = await db.prompt.findFirst({
      where: {
        OR: [
          {
            AND: [
              this.listWhere(context),
              { OR: [{ id: promptIdOrSlug }, { slug: promptIdOrSlug }] },
            ],
          },
          ...(communityWorkspaceId
            ? [{ workspaceId: communityWorkspaceId, visibility: 'PUBLIC' as const, OR: [{ id: promptIdOrSlug }, { slug: promptIdOrSlug }] }]
            : []),
        ],
      },
    })
    return prompt ? formatPrompt(prompt) : null
  }

  async create(
    context: AuthContext,
    data: {
      name: string
      key?: string
      description?: string
      kind?: PromptKind
      category?: string
      tags?: string[]
      systemPrompt: string
      userPrompt: string
      uid?: string
      outputTarget?: string
      outputFormat?: string
      sortOrder?: number
      isDefault?: boolean
    },
  ) {
    authorization.authorize(context, 'resource:edit')
    const kind = data.kind ?? 'TRANSFORMATIONAL'
    const key = slugify(data.key ?? data.name)
    const hash = promptHash(data.systemPrompt, data.userPrompt, data.outputTarget, kind)
    const existing = await db.prompt.findFirst({
      where: { workspaceId: context.workspaceId, OR: [{ key }, { promptHash: hash }] },
    })
    if (existing) {
      throw Object.assign(new Error(`A prompt with the key "${key}" or the same content already exists`), {
        statusCode: 409,
      })
    }

    if (kind === 'CONTENT' && data.isDefault) {
      await clearContentDefaults(context.workspaceId)
    }

    const slug = await uniqueSlug(data.name, context.workspaceId)
    const prompt = await db.prompt.create({
      data: {
        slug,
        key,
        name: data.name,
        description: data.description,
        kind,
        category: data.category ?? 'general',
        tags: data.tags ?? [],
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        uid: data.uid,
        outputTarget: data.outputTarget,
        outputFormat: data.outputFormat ?? 'text',
        visibility: 'PRIVATE',
        workspaceId: context.workspaceId,
        promptHash: hash,
        sortOrder: data.sortOrder ?? 0,
        isDefault: kind === 'CONTENT' ? (data.isDefault ?? false) : false,
      },
    })
    return formatPrompt(prompt)
  }

  async update(
    context: AuthContext,
    promptIdOrSlug: string,
    data: Partial<{
      name: string
      key: string
      description: string
      kind: PromptKind
      category: string
      tags: string[]
      systemPrompt: string
      userPrompt: string
      uid: string
      outputTarget: string
      outputFormat: string
      sortOrder: number
      isDefault: boolean
    }>,
  ) {
    const existing = await db.prompt.findFirst({
      where: { OR: [{ id: promptIdOrSlug }, { slug: promptIdOrSlug }] },
    })
    if (!existing) throw Object.assign(new Error('Prompt not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:edit', {
      workspaceId: existing.workspaceId ?? '',
      visibility: existing.visibility,
    })

    const kind = data.kind ?? existing.kind
    if (kind === 'CONTENT' && data.isDefault) {
      await clearContentDefaults(context.workspaceId, existing.id)
    }

    const systemPrompt = data.systemPrompt ?? existing.systemPrompt
    const userPrompt = data.userPrompt ?? existing.userPrompt
    const outputTarget = data.outputTarget !== undefined ? data.outputTarget : existing.outputTarget
    const hash = promptHash(systemPrompt, userPrompt, outputTarget, kind)
    const name = data.name ?? existing.name
    const slug = data.name ? await uniqueSlug(name, context.workspaceId, existing.id) : existing.slug
    const key = data.key ? slugify(data.key) : (existing.key ?? slugify(name))

    const prompt = await db.prompt.update({
      where: { id: existing.id },
      data: {
        ...data,
        slug,
        key,
        tags: data.tags ?? undefined,
        promptHash: hash,
        ...(kind !== 'CONTENT' ? { isDefault: false } : {}),
        ...(kind === 'CONTENT' && data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    })
    return formatPrompt(prompt)
  }

  async delete(context: AuthContext, promptIdOrSlug: string) {
    const existing = await db.prompt.findFirst({
      where: { OR: [{ id: promptIdOrSlug }, { slug: promptIdOrSlug }] },
    })
    if (!existing) throw Object.assign(new Error('Prompt not found'), { statusCode: 404 })
    authorization.authorize(context, 'resource:delete', {
      workspaceId: existing.workspaceId ?? '',
      visibility: existing.visibility,
    })
    await db.prompt.delete({ where: { id: existing.id } })
  }
}
