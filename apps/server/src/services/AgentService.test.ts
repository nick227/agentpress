import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
const create = vi.fn()
const update = vi.fn()

vi.mock('@project/db', () => ({
  db: { agent: {
    findMany: (...args: unknown[]) => findMany(...args),
    findFirst: (...args: unknown[]) => findFirst(...args),
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    delete: vi.fn(),
  } },
}))
vi.mock('./communityWorkspace', () => ({ getCommunityWorkspaceId: vi.fn().mockResolvedValue('community') }))

import { AgentService } from './AgentService'

const context = { userId: 'user', workspaceId: 'workspace', workspaceType: 'PERSONAL' as const, role: 'OWNER' as const }
const base = {
  id: 'agent', workspaceId: 'workspace', visibility: 'PRIVATE', key: 'writer', slug: 'writer', name: 'Writer',
  description: null, category: 'writing', tags: [], kind: 'AI_TEXT', defaultUid: 'writer', systemPrompt: 'System',
  userPrompt: 'User', outputTarget: 'body', outputFormat: 'markdown', sourceAgentId: null, usageCount: 0,
  agentHash: 'hash', createdAt: new Date(), updatedAt: new Date(),
}

describe('AgentService resource contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists only workspace-owned Agents by default', async () => {
    findMany.mockResolvedValue([{ ...base }])
    const result = await new AgentService().list(context)
    expect(result).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ workspaceId: 'workspace' }]) },
    }))
  })

  it('shadows Community Agents by key and orders owned Agents first', async () => {
    findMany.mockResolvedValue([
      { ...base, id: 'community-writer', workspaceId: 'community', visibility: 'PUBLIC' },
      { ...base, id: 'owned-writer' },
      { ...base, id: 'community-editor', workspaceId: 'community', visibility: 'PUBLIC', key: 'editor', slug: 'editor', name: 'Editor' },
    ])
    const result = await new AgentService().list(context, { resolved: true })
    expect(result.map((agent) => agent.id)).toEqual(['owned-writer', 'community-editor'])
  })

  it('does not allow Community Agents to be edited', async () => {
    findFirst.mockResolvedValue(null)
    await expect(new AgentService().update(context, 'community-writer', { name: 'Changed' })).rejects.toThrow('Agent not found')
    expect(update).not.toHaveBeenCalled()
  })

  it('creates a private override with the Community key and provenance', async () => {
    const community = { ...base, id: 'community-writer', workspaceId: 'community', visibility: 'PUBLIC' }
    findFirst
      .mockResolvedValueOnce(community)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    create.mockImplementation(async ({ data }) => ({ ...base, ...data, id: 'override', createdAt: new Date(), updatedAt: new Date() }))
    const result = await new AgentService().create(context, {
      name: 'My Writer', kind: 'AI_TEXT', defaultUid: 'writer', systemPrompt: 'Mine', userPrompt: 'User',
      outputTarget: 'body', outputFormat: 'markdown', sourceAgentId: community.id,
    })
    expect(result).toMatchObject({ visibility: 'PRIVATE', key: 'writer', sourceAgentId: community.id })
  })

  it('updates only the Agent definition and never PipelineAgent snapshots', async () => {
    findFirst.mockResolvedValueOnce(base).mockResolvedValueOnce(null)
    update.mockImplementation(async ({ data }) => ({ ...base, ...data }))
    await new AgentService().update(context, base.id, { systemPrompt: 'Updated' })
    expect(update).toHaveBeenCalledOnce()
  })
})
