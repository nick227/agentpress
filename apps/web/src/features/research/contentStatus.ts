import type { components } from '@project/sdk'

type ContentStatus = NonNullable<components['schemas']['ResearchItem']['contentStatus']>

export function resolveContentStatus(
  item: Pick<components['schemas']['ResearchItem'], 'content' | 'contentStatus'>,
): ContentStatus | undefined {
  if (item.contentStatus) return item.contentStatus
  if (item.content?.trim()) return 'ok'
  return undefined
}

export function contentStatusMessage(status: ContentStatus | undefined, sourceType: string): string | null {
  if (sourceType !== 'youtube' || !status || status === 'ok') return null

  switch (status) {
    case 'disabled':
      return 'Transcript unavailable — captions are disabled on this video.'
    case 'unavailable':
      return 'Transcript unavailable — no captions found for this video.'
    case 'rate_limited':
      return 'Rate limited by YouTube — try again later.'
    case 'error':
      return 'Transcript fetch failed — try again.'
    default:
      return 'Transcript not available.'
  }
}

export function canRetryTranscript(status: ContentStatus | undefined, sourceType: string): boolean {
  return sourceType === 'youtube' && status !== 'ok' && status !== 'disabled'
}
