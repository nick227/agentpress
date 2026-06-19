import { randomBytes } from 'crypto'
import { mimeTypeForAsset } from './OutputAssetService'

export type WordPressCredentials = {
  siteUrl: string
  username: string
  appPassword: string
}

export function sanitizeMediaFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!safe || safe === '.' || safe === '..') return 'agentpress-image.png'
  if (!/\.(png|jpe?g|webp|gif)$/i.test(safe)) return `${safe}.png`
  return safe
}

export function mediaMimeType(filename: string): string {
  const mime = mimeTypeForAsset(filename)
  return mime === 'application/octet-stream' ? 'image/png' : mime
}

type MultipartField =
  | { name: string; value: string }
  | { name: string; value: Buffer; filename: string; contentType: string }

export function buildMultipartBody(fields: MultipartField[], boundary: string): Buffer {
  const chunks: Buffer[] = []
  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if ('filename' in field) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\nContent-Type: ${field.contentType}\r\n\r\n`,
      ))
      chunks.push(field.value)
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`))
      chunks.push(Buffer.from(field.value))
    }
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

export function newMultipartBoundary(): string {
  return `agentpress-${randomBytes(8).toString('hex')}`
}
