import type { components } from '@project/sdk'
import { contentStatusMessage } from './contentStatus'

type ResearchCheckResult = components['schemas']['ResearchCheckResult']
type ResearchCheckLatest = NonNullable<ResearchCheckResult['latest']>

export type CheckFeedback = { variant: 'success' | 'error' | 'info'; message: string }

function youtubeTranscriptDetail(latest: ResearchCheckLatest): string | null {
  if (latest.hasTranscript) return null
  return contentStatusMessage(latest.contentStatus, 'youtube') ?? 'Transcript not available.'
}

function youtubeFeedback(result: ResearchCheckResult): CheckFeedback {
  const latest = result.latest

  if (!latest) {
    return { variant: 'info', message: 'No videos found on this channel.' }
  }

  const title = `"${latest.title}"`
  const transcriptIssue = youtubeTranscriptDetail(latest)

  if (result.newItem) {
    if (latest.hasTranscript) {
      return { variant: 'success', message: `New video ${title} — transcript fetched.` }
    }
    return { variant: 'error', message: `New video ${title} — ${transcriptIssue}` }
  }

  if (latest.contentChecked) {
    if (latest.hasTranscript) {
      return { variant: 'success', message: `Latest video ${title} — transcript fetched.` }
    }
    return { variant: 'error', message: `Latest video ${title} — ${transcriptIssue}` }
  }

  if (result.updatedCount > 0) {
    return { variant: 'success', message: `Latest video ${title} — content refreshed.` }
  }

  if (latest.hasTranscript) {
    return { variant: 'info', message: `No new videos. Latest ${title} — transcript on file.` }
  }

  if (transcriptIssue) {
    return { variant: 'error', message: `No new videos. Latest ${title} — ${transcriptIssue}` }
  }

  return { variant: 'info', message: 'No new videos since last check.' }
}

function defaultFeedback(
  result: ResearchCheckResult,
  labels: { newLabel: (n: number) => string; updatedLabel: (n: number) => string; noNewLabel: string },
): CheckFeedback {
  if (result.newItem) {
    return { variant: 'success', message: labels.newLabel(result.newCount) }
  }
  if (result.updatedCount > 0) {
    return { variant: 'success', message: labels.updatedLabel(result.updatedCount) }
  }
  return { variant: 'info', message: labels.noNewLabel }
}

export function researchCheckFeedback(
  sourceType: string,
  result: ResearchCheckResult,
  labels?: { newLabel: (n: number) => string; updatedLabel: (n: number) => string; noNewLabel: string },
): CheckFeedback {
  if (!result.checked) {
    return { variant: 'error', message: result.message ?? 'Could not resolve source. Check the URL.' }
  }

  if (sourceType === 'youtube') {
    return youtubeFeedback(result)
  }

  return defaultFeedback(result, labels ?? {
    newLabel: (n) => `${n} new item${n !== 1 ? 's' : ''} fetched!`,
    updatedLabel: (n) => `${n} item${n !== 1 ? 's' : ''} refreshed.`,
    noNewLabel: 'No new items since last check.',
  })
}

export function researchCheckSyncLine(result: ResearchCheckResult, sourceType: string): string {
  const feedback = researchCheckFeedback(sourceType, result)
  return feedback.message
}
