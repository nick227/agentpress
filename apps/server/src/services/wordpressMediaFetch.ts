import type { WordPressCredentials } from './wordpressMediaShared'
import { wordpressReachabilityHint } from './serverFetchUrl'
import {
  buildMultipartBody,
  mediaMimeType,
  newMultipartBoundary,
  sanitizeMediaFilename,
} from './wordpressMediaShared'

export async function uploadMediaViaFetch(
  url: string,
  credentials: WordPressCredentials,
  imageBuffer: Uint8Array,
  filename: string,
  meta?: { alt?: string; caption?: string; title?: string; contentType?: string },
): Promise<{ id: number; url: string }> {
  const safeFilename = sanitizeMediaFilename(filename)
  const contentType = meta?.contentType ?? mediaMimeType(safeFilename)
  const boundary = newMultipartBoundary()
  const fields = [
    {
      name: 'file',
      value: Buffer.from(imageBuffer),
      filename: safeFilename,
      contentType,
    },
    ...(meta?.alt ? [{ name: 'alt_text', value: meta.alt }] : []),
    ...(meta?.caption ? [{ name: 'caption', value: meta.caption }] : []),
    ...(meta?.title ? [{ name: 'title', value: meta.title }] : []),
  ] as Array<
    | { name: string; value: string }
    | { name: string; value: Buffer; filename: string; contentType: string }
  >

  const body = buildMultipartBody(fields, boundary)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64')}`,
        'User-Agent': 'AgentPress/1.0',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body: new Uint8Array(body),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const cause = (err as Error & { cause?: { code?: string } }).cause?.code
    throw new Error(
      `WordPress media upload request failed for ${url}: ${message}${cause ? ` (${cause})` : ''}.${wordpressReachabilityHint(credentials.siteUrl)}`,
    )
  }

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 413 || /entity too large/i.test(text)) {
      throw new Error(
        'WordPress host rejected the upload (413 Request Entity Too Large). '
        + 'AgentPress compresses images automatically; raise the host client_max_body_size or WORDPRESS_MAX_UPLOAD_BYTES.',
      )
    }
    throw new Error(`WordPress media upload failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as { id: number; source_url?: string; guid?: { rendered?: string } }
  return {
    id: data.id,
    url: data.source_url ?? data.guid?.rendered ?? '',
  }
}
