import { beforeEach, describe, expect, it, vi } from 'vitest'

const findPrompts = vi.fn()

vi.mock('@project/db', () => ({
  db: {
    prompt: {
      findMany: (...args: unknown[]) => findPrompts(...args),
    },
  },
}))

vi.mock('./communityWorkspace', () => ({
  getCommunityWorkspaceId: vi.fn().mockResolvedValue('community-1'),
}))

import { PromptService } from './PromptService'

const context = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  workspaceType: 'PERSONAL' as const,
  role: 'OWNER' as const,
}

function prompt(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'prompt-1',
    slug: 'writer',
    key: 'writer',
    name: 'Writer',
    description: null,
    kind: 'TRANSFORMATIONAL',
    category: 'writing',
    tags: [],
    systemPrompt: 'System',
    userPrompt: 'User',
    uid: null,
    outputTarget: null,
    outputFormat: 'text',
    visibility: 'PRIVATE',
    workspaceId: 'workspace-1',
    sourcePromptId: null,
    promptHash: 'hash',
    usageCount: 0,
    sortOrder: 0,
    isDefault: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('PromptService catalog resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the default list workspace-owned for the sidebar', async () => {
    findPrompts.mockResolvedValue([prompt({ id: 'owned' })])

    const result = await new PromptService().list(context, { kind: 'TRANSFORMATIONAL' })

    expect(result.map((item) => item.id)).toEqual(['owned'])
    expect(findPrompts).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ workspaceId: 'workspace-1' }]),
      }),
    }))
  })

  it('shows the resolved catalog while workspace prompts shadow community prompts by key', async () => {
    findPrompts.mockResolvedValue([
      prompt({
        id: 'community-writer',
        visibility: 'PUBLIC',
        workspaceId: 'community-1',
      }),
      prompt({
        id: 'owned-writer',
        systemPrompt: 'My system prompt',
      }),
      prompt({
        id: 'community-editor',
        slug: 'editor',
        key: 'editor',
        name: 'Editor',
        visibility: 'PUBLIC',
        workspaceId: 'community-1',
      }),
    ])

    const result = await new PromptService().list(context, {
      kind: 'TRANSFORMATIONAL',
      resolved: true,
    })

    expect(result).toHaveLength(2)
    expect(result.map((item) => item.id)).toEqual(['owned-writer', 'community-editor'])
    expect(result.find((item) => item.key === 'writer')).toMatchObject({
      id: 'owned-writer',
      visibility: 'PRIVATE',
      systemPrompt: 'My system prompt',
    })
    expect(result.find((item) => item.key === 'editor')).toMatchObject({
      id: 'community-editor',
      visibility: 'PUBLIC',
    })
  })
})
