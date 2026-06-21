import { beforeEach, describe, expect, it, vi } from 'vitest'

const findSources = vi.fn()
const findItem = vi.fn()
const findPrompt = vi.fn()
const findSummary = vi.fn()

vi.mock('@project/db', () => ({
  db: {
    researchSource: { findMany: (...args: unknown[]) => findSources(...args) },
    researchItem: { findFirst: (...args: unknown[]) => findItem(...args) },
    summaryPrompt: {
      findFirst: (...args: unknown[]) => findPrompt(...args),
      findUnique: vi.fn(),
    },
    prompt: {
      findFirst: (...args: unknown[]) => findPrompt(...args),
      findUnique: vi.fn(),
    },
    researchSummary: { findUnique: (...args: unknown[]) => findSummary(...args) },
  },
}))

vi.mock('./communityWorkspace', () => ({
  getCommunityWorkspaceId: vi.fn().mockResolvedValue('community-1'),
}))

import { ResearchContextService } from './ResearchContextService'

describe('ResearchContextService pinned schedule input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findSources.mockResolvedValue([{ id: 'source-1', slug: 'feed', name: 'Feed', sourceType: 'rss', workspaceId: 'workspace-1' }])
    findPrompt.mockResolvedValue({ id: 'prompt-1', name: 'Brief' })
    findSummary.mockResolvedValue({ status: 'done', text: 'Pinned summary' })
    findItem.mockResolvedValue({
      id: 'item-pinned',
      sourceId: 'source-1',
      title: 'Fresh item',
      itemUrl: 'https://example.com/fresh',
      publishedAt: new Date('2026-06-19T12:00:00Z'),
      content: 'Fresh content',
    })
  })

  it('resolves an ordinary feed reference from the pinned item ID', async () => {
    const result = await new ResearchContextService().resolveForPipeline({
      workspaceId: 'workspace-1',
      agents: [{ systemPrompt: '', userPrompt: '{feed.summary}' }],
    }, { 'source-1': 'item-pinned' })

    expect(findItem).toHaveBeenCalledWith({ where: { id: 'item-pinned', sourceId: 'source-1' } })
    expect(result.feed?.itemId).toBe('item-pinned')
    expect(result.feed?.summary).toBe('Pinned summary')
  })

  it('keeps explicit date references independent from the pinned item', async () => {
    await new ResearchContextService().resolveForPipeline({
      workspaceId: 'workspace-1',
      agents: [{ systemPrompt: '', userPrompt: '{feed.2026-06-18.summary}' }],
    }, { 'source-1': 'item-pinned' })

    expect(findItem).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceId: 'source-1',
        publishedAt: expect.objectContaining({ gte: new Date('2026-06-18T00:00:00.000Z') }),
      }),
    }))
  })

  it('rejects a community feed until it has been added to the workspace', async () => {
    findSources.mockResolvedValue([{
      id: 'community-source',
      slug: 'feed',
      name: 'Feed',
      sourceType: 'rss',
      workspaceId: 'community-1',
      visibility: 'PUBLIC',
    }])

    await expect(new ResearchContextService().resolveForPipeline({
      workspaceId: 'workspace-1',
      agents: [{ systemPrompt: '', userPrompt: '{feed.summary}' }],
    })).rejects.toThrow('Add it to your workspace before running')

    expect(findItem).not.toHaveBeenCalled()
  })
})
