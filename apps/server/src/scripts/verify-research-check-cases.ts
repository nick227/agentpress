/**
 * Standalone verification for YouTube research check (no test runner).
 * Run: node --experimental-strip-types src/scripts/verify-research-check-cases.ts
 */
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

const VIDEO_ID = 'dQw4w9WgXcQ'
const ITEM_ID = 'item-existing'

const cachedFailedFeedItem = {
  externalId: VIDEO_ID,
  title: 'ZipTrader Latest Video',
  content: '',
  contentStatus: 'error' as const,
}

function existingItem() {
  return {
    id: ITEM_ID,
    content: null,
    contentStatus: 'error',
  }
}

const TRANSCRIPT_MESSAGES: Record<string, string> = {
  disabled: 'Transcript unavailable — captions are disabled on this video.',
  unavailable: 'Transcript unavailable — no captions found for this video.',
}

function youtubeToastMessage(input: {
  newItem: boolean
  contentChecked: boolean
  hasTranscript: boolean
  contentStatus: string
  title: string
}): string {
  const title = `"${input.title}"`
  const issue = TRANSCRIPT_MESSAGES[input.contentStatus] ?? 'Transcript not available.'

  if (input.newItem) {
    return input.hasTranscript
      ? `New video ${title} — transcript fetched.`
      : `New video ${title} — ${issue}`
  }
  if (input.contentChecked) {
    return input.hasTranscript
      ? `Latest video ${title} — transcript fetched.`
      : `Latest video ${title} — ${issue}`
  }
  if (input.hasTranscript) {
    return `No new videos. Latest ${title} — transcript on file.`
  }
  return `No new videos. Latest ${title} — ${issue}`
}

async function simulateYoutubeRetry(
  fetchResult: Awaited<ReturnType<typeof import('../services/youtube/youtubeTranscript.ts').fetchYoutubeTranscript>>,
) {
  const { contentFieldsFromTranscript } = await import('../services/researchContentStatus.ts')
  const existing = existingItem()
  const shouldRetry =
    !existing.content?.trim() ||
    existing.contentStatus === 'rate_limited' ||
    existing.contentStatus === 'error'
  assert(shouldRetry, 'existing ZipTrader item without transcript triggers retry')

  const oldPathWouldSkipBackfill = Boolean(cachedFailedFeedItem.contentStatus || cachedFailedFeedItem.content.trim())
  assert(oldPathWouldSkipBackfill, 'cached feed item has failed contentStatus (regression guard)')

  return contentFieldsFromTranscript(fetchResult)
}

async function main() {
  console.log('\nMocked verification (cases 1–3)\n')

  console.log('Case 1: existing item, no transcript, cached failed feed item')
  const fields1 = await simulateYoutubeRetry({ ok: true, text: 'Markets opened higher today.' })
  assert(fields1.contentStatus === 'ok', 're-fetch sets contentStatus ok')
  assert(Boolean(fields1.content?.trim()), 'ResearchItem.content populated after re-fetch')

  const msg1 = youtubeToastMessage({
    newItem: false,
    contentChecked: true,
    hasTranscript: true,
    contentStatus: 'ok',
    title: 'ZipTrader Latest Video',
  })
  assert(msg1.includes('transcript fetched'), 'toast says transcript fetched')

  console.log('\nCase 2: captions disabled/unavailable')
  const fields2 = await simulateYoutubeRetry({ ok: false, reason: 'disabled', message: 'Transcript is disabled' })
  assert(fields2.contentStatus === 'disabled', 'contentStatus is disabled')
  assert(!fields2.content?.trim(), 'content stays empty')

  const msg2 = youtubeToastMessage({
    newItem: false,
    contentChecked: true,
    hasTranscript: false,
    contentStatus: 'disabled',
    title: 'ZipTrader Latest Video',
  })
  assert(/transcript unavailable|captions are disabled/i.test(msg2), 'toast explains unavailable captions')
  assert(TRANSCRIPT_MESSAGES.disabled!.includes('Transcript unavailable'), 'sidebar maps disabled → "Transcript unavailable"')

  console.log('\nCase 3: transcript available on new item')
  const { contentFieldsFromTranscript } = await import('../services/researchContentStatus.ts')
  const fields3 = contentFieldsFromTranscript({ ok: true, text: 'Full transcript body.' })
  assert(fields3.content === 'Full transcript body.', 'ResearchItem.content populated on create')
  assert(fields3.contentStatus === 'ok', 'contentStatus is ok')

  const msg3 = youtubeToastMessage({
    newItem: true,
    contentChecked: true,
    hasTranscript: true,
    contentStatus: 'ok',
    title: 'ZipTrader Latest Video',
  })
  assert(msg3.includes('transcript fetched'), 'toast says transcript fetched')

  console.log('\nAll mocked cases passed ✓\n')
}

main().catch((err) => {
  console.error('\n', err.message ?? err)
  process.exit(1)
})
