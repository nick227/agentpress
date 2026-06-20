import sharp from 'sharp'
import { mediaMimeType, sanitizeMediaFilename } from './wordpressMediaShared'

const DEFAULT_MAX_BYTES = 900_000

function maxWordPressUploadBytes(): number {
  const raw = process.env.WORDPRESS_MAX_UPLOAD_BYTES?.trim()
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_BYTES
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES
}

export type PreparedUploadImage = {
  buffer: Buffer
  filename: string
  contentType: string
}

function asJpegFilename(filename: string): string {
  const base = filename.replace(/\.(png|jpe?g|webp|gif)$/i, '')
  return `${base}.jpg`
}

export async function prepareImageForWordPressUpload(
  imageBuffer: Uint8Array,
  filename: string,
): Promise<PreparedUploadImage> {
  const safeFilename = sanitizeMediaFilename(filename)
  const buffer = Buffer.from(imageBuffer)
  const maxBytes = maxWordPressUploadBytes()

  if (buffer.length <= maxBytes) {
    return {
      buffer,
      filename: safeFilename,
      contentType: mediaMimeType(safeFilename),
    }
  }

  const meta = await sharp(buffer).metadata()
  const maxDim = Number.parseInt(process.env.WORDPRESS_MAX_IMAGE_DIMENSION?.trim() ?? '1600', 10)
  const resize = (meta.width ?? 0) > maxDim || (meta.height ?? 0) > maxDim
    ? { width: maxDim, height: maxDim, fit: 'inside' as const, withoutEnlargement: true }
    : undefined

  for (const quality of [85, 75, 65, 55, 45]) {
    let pipeline = sharp(buffer)
    if (resize) pipeline = pipeline.resize(resize)
    const jpeg = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
    if (jpeg.length <= maxBytes) {
      return {
        buffer: jpeg,
        filename: asJpegFilename(safeFilename),
        contentType: 'image/jpeg',
      }
    }
  }

  const jpeg = await sharp(buffer)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 40, mozjpeg: true })
    .toBuffer()

  if (jpeg.length > maxBytes) {
    throw new Error(
      `Image is too large for WordPress upload (${buffer.length} bytes, limit ~${maxBytes}). `
      + 'Increase WORDPRESS_MAX_UPLOAD_BYTES after raising the host upload limit, or use a smaller source image.',
    )
  }

  return {
    buffer: jpeg,
    filename: asJpegFilename(safeFilename),
    contentType: 'image/jpeg',
  }
}
