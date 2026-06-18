type LatestItem = {
  title: string
  contentStatus: string
  contentErrorReason: string | null
  hasTranscript: boolean
  isNew: boolean
  contentChecked: boolean
}

type CheckResult = {
  checked: boolean
  newItem: boolean
  newCount: number
  updatedCount: number
  latest?: LatestItem
}

const TRANSCRIPT_MESSAGES: Record<string, string> = {
  disabled: 'Transcript unavailable — captions are disabled on this video.',
  unavailable: 'Transcript unavailable — no captions found for this video.',
  rate_limited: 'Rate limited by YouTube — try again later.',
  error: 'Transcript fetch failed — try again.',
}

function transcriptDetail(latest: LatestItem): string {
  if (latest.hasTranscript) return ''
  return TRANSCRIPT_MESSAGES[latest.contentStatus] ?? 'Transcript not available.'
}

function youtubeMessage(result: CheckResult): string {
  const latest = result.latest
  if (!latest) return 'No videos found on this channel.'

  const title = `"${latest.title}"`
  const issue = transcriptDetail(latest)

  if (result.newItem) {
    return latest.hasTranscript
      ? `New video ${title} — transcript fetched.`
      : `New video ${title} — ${issue}`
  }

  if (latest.contentChecked) {
    return latest.hasTranscript
      ? `Latest video ${title} — transcript fetched.`
      : `Latest video ${title} — ${issue}`
  }

  if (result.updatedCount > 0) {
    return `Latest video ${title} — content refreshed.`
  }

  if (latest.hasTranscript) {
    return `No new videos. Latest ${title} — transcript on file.`
  }

  if (issue) {
    return `No new videos. Latest ${title} — ${issue}`
  }

  return 'No new videos since last check.'
}

export function formatResearchCheckMessage(sourceType: string, result: CheckResult): string {
  if (!result.checked) return 'Could not resolve source. Check the URL.'
  if (sourceType === 'youtube') return youtubeMessage(result)

  if (result.newItem) {
    const n = result.newCount
    return `${n} new item${n !== 1 ? 's' : ''} fetched!`
  }
  if (result.updatedCount > 0) {
    const n = result.updatedCount
    return `${n} item${n !== 1 ? 's' : ''} refreshed.`
  }
  return 'No new items since last check.'
}
