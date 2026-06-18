import type { TranscriptFetchResult } from './youtube/youtubeTranscript'

export type ContentStatus = 'ok' | 'disabled' | 'unavailable' | 'rate_limited' | 'error'

export type ContentFields = {
  content: string | null
  contentStatus: ContentStatus
  contentErrorReason: string | null
  contentCheckedAt: Date
}

export function contentFieldsFromTranscript(result: TranscriptFetchResult): ContentFields {
  const contentCheckedAt = new Date()
  if (result.ok) {
    return {
      content: result.text,
      contentStatus: 'ok',
      contentErrorReason: null,
      contentCheckedAt,
    }
  }
  return {
    content: null,
    contentStatus: result.reason,
    contentErrorReason: result.message,
    contentCheckedAt,
  }
}

export function contentFieldsFromPlainContent(content: string): ContentFields {
  const trimmed = content.trim()
  return {
    content: trimmed || null,
    contentStatus: trimmed ? 'ok' : 'unavailable',
    contentErrorReason: trimmed ? null : 'No content collected',
    contentCheckedAt: new Date(),
  }
}

export function contentFieldsFromFeedItem(feedItem: {
  content: string
  contentStatus?: ContentStatus
  contentErrorReason?: string | null
}): ContentFields {
  if (feedItem.contentStatus) {
    return {
      content: feedItem.content.trim() || null,
      contentStatus: feedItem.contentStatus,
      contentErrorReason: feedItem.contentErrorReason ?? null,
      contentCheckedAt: new Date(),
    }
  }
  return contentFieldsFromPlainContent(feedItem.content)
}
