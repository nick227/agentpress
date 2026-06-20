import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSourceFind = vi.fn()
const mockSourceUpdate = vi.fn()
const mockItemFindUnique = vi.fn()
const mockItemUpdate = vi.fn()
const mockItemCreate = vi.fn()
const mockFetchTranscript = vi.fn()

vi.mock('@project/db', () => ({
  db: {
    researchSource: {
      findFirstOrThrow: (...args: unknown[]) => mockSourceFind(...args),
      update: (...args: unknown[]) => mockSourceUpdate(...args),
    },
    researchItem: {
      findUnique: (...args: unknown[]) => mockItemFindUnique(...args),
      update: (...args: unknown[]) => mockItemUpdate(...args),
      create: (...args: unknown[]) => mockItemCreate(...args),
    },
    researchFetchCache: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

vi.mock('./youtube/youtubeTranscript', () => ({
  fetchYoutubeTranscript: (...args: unknown[]) => mockFetchTranscript(...args),
}))

import { ResearchService } from './ResearchService'

const VIDEO_ID = 'dQw4w9WgXcQ'
const SOURCE_ID = 'src-ziptrader'
const ITEM_ID = 'item-existing'

const source = {
  id: SOURCE_ID,
  sourceType: 'youtube',
  externalId: 'UCtestchannel',
  sourceUrl: 'https://www.youtube.com/@ZipTrader',
}

const cachedFailedFeedItem = {
  externalId: VIDEO_ID,
  title: 'ZipTrader Latest Video',
  itemUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  publishedAt: new Date('2026-06-18T12:00:00Z'),
  content: '',
  contentStatus: 'error' as const,
  contentErrorReason: 'Cached feed failure — should not be reused on retry',
}

function existingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    sourceId: SOURCE_ID,
    externalId: VIDEO_ID,
    title: 'ZipTrader Latest Video',
    itemUrl: cachedFailedFeedItem.itemUrl,
    publishedAt: cachedFailedFeedItem.publishedAt,
    content: null,
    contentStatus: 'error',
    contentErrorReason: 'Previous fetch failed',
    contentCheckedAt: new Date('2026-06-17T12:00:00Z'),
    ...overrides,
  }
}

describe('ResearchService.checkLatest — YouTube transcript checks', () => {
  let svc: ResearchService
  let fetchLatestCached: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new ResearchService()
    fetchLatestCached = vi.spyOn(svc as unknown as { fetchLatestCached: () => Promise<unknown> }, 'fetchLatestCached')
    fetchLatestCached.mockResolvedValue([cachedFailedFeedItem])

    mockSourceFind.mockResolvedValue(source)
    mockSourceUpdate.mockResolvedValue(source)
    mockItemFindUnique.mockResolvedValue(existingItem())
  })

  it('case 1: existing item without transcript re-fetches from YouTube, not cached feed failure', async () => {
    mockFetchTranscript.mockResolvedValue({
      ok: true,
      text: 'Markets opened higher today with tech leading the move.',
    })
    mockItemUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(existingItem({ ...data, id: ITEM_ID })),
    )

    const result = await svc.checkLatest(SOURCE_ID)

    expect(mockFetchTranscript).toHaveBeenCalledTimes(1)
    expect(mockFetchTranscript).toHaveBeenCalledWith(VIDEO_ID)
    expect(result.latest?.contentChecked).toBe(true)
    expect(result.latest?.hasTranscript).toBe(true)
    expect(result.latest?.contentStatus).toBe('ok')
    expect(mockItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Markets opened higher today with tech leading the move.',
          contentStatus: 'ok',
        }),
      }),
    )
  })

  it('case 2: captions disabled/unavailable — error toast and no transcript on item', async () => {
    mockFetchTranscript.mockResolvedValue({
      ok: false,
      reason: 'disabled',
      message: 'Transcript is disabled on this video',
    })
    mockItemUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(existingItem({ ...data, id: ITEM_ID })),
    )

    const result = await svc.checkLatest(SOURCE_ID)

    expect(mockFetchTranscript).toHaveBeenCalledWith(VIDEO_ID)
    expect(result.latest?.hasTranscript).toBe(false)
    expect(result.latest?.contentStatus).toBe('disabled')
  })

  it('case 3: transcript available — success toast and content populated on new item', async () => {
    mockItemFindUnique.mockResolvedValue(null)
    mockFetchTranscript.mockResolvedValue({
      ok: true,
      text: 'Full transcript body for the latest ZipTrader video.',
    })
    mockItemCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'item-new',
        sourceId: SOURCE_ID,
        externalId: VIDEO_ID,
        title: cachedFailedFeedItem.title,
        itemUrl: cachedFailedFeedItem.itemUrl,
        publishedAt: cachedFailedFeedItem.publishedAt,
        content: data.content,
        contentStatus: data.contentStatus,
        contentErrorReason: data.contentErrorReason,
        contentCheckedAt: data.contentCheckedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    )

    const result = await svc.checkLatest(SOURCE_ID)

    expect(result.newItem).toBe(true)
    expect(result.latest?.hasTranscript).toBe(true)
    expect(mockItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Full transcript body for the latest ZipTrader video.',
          contentStatus: 'ok',
        }),
      }),
    )
  })
})
