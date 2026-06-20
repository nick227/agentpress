import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
} from 'youtube-transcript'

export type TranscriptFailureReason = 'disabled' | 'unavailable' | 'rate_limited' | 'error'

export type TranscriptFetchResult =
  | { ok: true; text: string; language?: string }
  | { ok: false; reason: TranscriptFailureReason; message: string }

const LANGUAGE_TRY_ORDER = ['en', undefined] as const
const MAX_RATE_LIMIT_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanTranscript(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function joinSegments(segments: Array<{ text: string; lang?: string }>): { text: string; language?: string } {
  const text = cleanTranscript(segments.map((segment) => segment.text.trim()).filter(Boolean).join(' '))
  const language = segments.find((segment) => segment.lang)?.lang
  return { text, language }
}

type TranscriptFailure = Extract<TranscriptFetchResult, { ok: false }>

function classifyError(err: unknown, videoId: string): TranscriptFailure {
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return { ok: false, reason: 'rate_limited', message: err.message }
  }
  if (err instanceof YoutubeTranscriptDisabledError) {
    return { ok: false, reason: 'disabled', message: err.message }
  }
  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return { ok: false, reason: 'unavailable', message: err.message }
  }
  if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return { ok: false, reason: 'unavailable', message: err.message }
  }

  const message = err instanceof Error ? err.message : `Transcript fetch failed for ${videoId}`
  return { ok: false, reason: 'error', message }
}

function shouldTryNextLanguage(result: TranscriptFailure): boolean {
  return !result.ok && result.reason === 'unavailable' && result.message.includes('No transcripts are available in')
}

export async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptFetchResult> {
  let lastFailure: TranscriptFailure = {
    ok: false,
    reason: 'unavailable',
    message: `No transcript available for ${videoId}`,
  }

  for (const lang of LANGUAGE_TRY_ORDER) {
    for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        const segments = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined)
        const joined = joinSegments(segments)
        if (!joined.text) {
          lastFailure = { ok: false, reason: 'unavailable', message: `Transcript segments were empty for ${videoId}` }
          break
        }
        return { ok: true, text: joined.text, language: joined.language ?? lang }
      } catch (err) {
        const failure = classifyError(err, videoId)
        lastFailure = failure

        if (failure.reason === 'rate_limited' && attempt < MAX_RATE_LIMIT_RETRIES - 1) {
          await sleep(1000 * (attempt + 1))
          continue
        }

        if (failure.reason === 'disabled') return failure
        if (shouldTryNextLanguage(failure)) break
        if (failure.reason === 'unavailable') return failure
        if (failure.reason === 'error' && attempt < MAX_RATE_LIMIT_RETRIES - 1) {
          await sleep(500)
          continue
        }
        return failure
      }
    }
  }

  return lastFailure
}
