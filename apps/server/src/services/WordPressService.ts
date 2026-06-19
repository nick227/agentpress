import { resolveServerFetchUrl } from './serverFetchUrl'
import { isWsl, shouldUseCurlFallback, uploadMediaViaCurl } from './wordpressMediaUpload'
import { uploadMediaViaFetch } from './wordpressMediaFetch'
import { prepareImageForWordPressUpload } from './wordpressImagePrepare'
import { sanitizeMediaFilename, type WordPressCredentials } from './wordpressMediaShared'

export type { WordPressCredentials } from './wordpressMediaShared'
export { sanitizeMediaFilename } from './wordpressMediaShared'

export type WordPressPostPayload = {
  title: string
  excerpt: string
  content: string
  status: 'draft' | 'publish'
  categoryIds?: number[]
}

export type WordPressCategory = {
  id: number
  name: string
  slug: string
  parent: number
  count: number
}

export type InlineImageUploadInput = {
  buffer: Buffer
  relativePath: string
  filename: string
  alt: string
  caption?: string
}

export type InlineImageUploadResult = {
  relativePath: string
  mediaId: number
  url: string
}

export type UploadInlineImagesResult = {
  body: string
  uploaded: InlineImageUploadResult[]
  failed: string[]
}

export function parseCategoryIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
}

export function resolveCategoryIds(
  pipeline: { wpCategoryIds?: unknown },
  destination: { defaultCategoryIds?: unknown },
): number[] {
  const pipelineIds = parseCategoryIds(pipeline.wpCategoryIds)
  if (pipelineIds.length > 0) return pipelineIds
  return parseCategoryIds(destination.defaultCategoryIds)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class WordPressService {
  private apiBase(siteUrl: string): string {
    return `${resolveServerFetchUrl(siteUrl.replace(/\/$/, ''))}/wp-json/wp/v2`
  }

  private authHeader(credentials: WordPressCredentials): string {
    return `Basic ${Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64')}`
  }

  async listCategories(credentials: WordPressCredentials): Promise<WordPressCategory[]> {
    const categories: WordPressCategory[] = []
    let page = 1

    while (true) {
      const url = `${this.apiBase(credentials.siteUrl)}/categories?per_page=100&page=${page}&orderby=name&order=asc`
      const response = await fetch(url, {
        headers: { Authorization: this.authHeader(credentials) },
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`WordPress categories fetch failed (${response.status}): ${body}`)
      }

      const data = (await response.json()) as Array<{
        id: number
        name: string
        slug: string
        parent: number
        count: number
      }>

      if (data.length === 0) break

      categories.push(...data.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        parent: item.parent,
        count: item.count,
      })))

      const totalPages = Number.parseInt(response.headers.get('X-WP-TotalPages') ?? '1', 10)
      if (page >= totalPages) break
      page++
    }

    return categories
  }

  async uploadMedia(
    credentials: WordPressCredentials,
    imageBuffer: Uint8Array,
    filename: string,
    meta?: { alt?: string; caption?: string; title?: string },
  ): Promise<{ id: number; url: string }> {
    const url = `${this.apiBase(credentials.siteUrl)}/media`
    const prepared = await prepareImageForWordPressUpload(imageBuffer, filename)

    if (isWsl()) {
      return uploadMediaViaCurl(url, credentials, prepared.buffer, prepared.filename, {
        ...meta,
        contentType: prepared.contentType,
      })
    }

    try {
      return await uploadMediaViaFetch(url, credentials, prepared.buffer, prepared.filename, {
        ...meta,
        contentType: prepared.contentType,
      })
    } catch (err) {
      if (!shouldUseCurlFallback(err)) throw err
      return uploadMediaViaCurl(url, credentials, prepared.buffer, prepared.filename, {
        ...meta,
        contentType: prepared.contentType,
      })
    }
  }

  async uploadInlineImages(
    credentials: WordPressCredentials,
    body: string,
    images: InlineImageUploadInput[],
    onProgress?: (message: string) => void | Promise<void>,
  ): Promise<UploadInlineImagesResult> {
    let nextBody = body
    const uploaded: InlineImageUploadResult[] = []
    const failed: string[] = []

    for (let index = 0; index < images.length; index++) {
      const image = images[index]!
      if (!image.buffer?.length || !image.relativePath) {
        failed.push(image.relativePath || 'unknown image')
        continue
      }

      await onProgress?.(`Uploading inline image ${index + 1}/${images.length} (${image.filename})…`)

      try {
        const result = await this.uploadMedia(
          credentials,
          image.buffer,
          image.filename,
          { alt: image.alt, caption: image.caption, title: image.alt },
        )
        nextBody = this.rewriteInlineImageSrc(nextBody, image.relativePath, result.url)
        uploaded.push({
          relativePath: image.relativePath,
          mediaId: result.id,
          url: result.url,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failed.push(`${image.relativePath}: ${message}`)
      }
    }

    return { body: nextBody, uploaded, failed }
  }

  private rewriteInlineImageSrc(body: string, relativePath: string, url: string): string {
    const escaped = escapeRegex(relativePath)
    if (body.includes(`data-ap-src="${relativePath}"`)) {
      return body.replace(
        new RegExp(`(<img[^>]*data-ap-src="${escaped}"[^>]*\\s)src="[^"]*"`, 'g'),
        `$1src="${url}"`,
      )
    }

    return body
      .replaceAll(`src="./${relativePath}"`, `src="${url}"`)
      .replaceAll(`src="${relativePath}"`, `src="${url}"`)
  }

  async publish(
    credentials: WordPressCredentials,
    post: WordPressPostPayload,
    thumbnailBuffer?: Uint8Array,
    onProgress?: (message: string) => void | Promise<void>,
  ): Promise<{ postId: string; postUrl: string; featuredImageUploaded: boolean }> {
    const url = `${this.apiBase(credentials.siteUrl)}/posts`

    let featuredMediaId: number | undefined
    let featuredImageUploaded = false
    if (thumbnailBuffer) {
      try {
        await onProgress?.('Uploading featured image…')
        featuredMediaId = await this.uploadMedia(
          credentials,
          thumbnailBuffer,
          'thumbnail.png',
          { title: post.title, alt: post.title },
        ).then((media) => media.id)
        featuredImageUploaded = true
      } catch {
        // Thumbnail upload failure is non-fatal — post still publishes without featured image.
      }
    }

    const payload: Record<string, unknown> = {
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status,
    }

    if (featuredMediaId !== undefined) payload.featured_media = featuredMediaId
    if (post.categoryIds && post.categoryIds.length > 0) payload.categories = post.categoryIds

    await onProgress?.(`Creating WordPress ${post.status}…`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(credentials),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WordPress publish failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as { id: number; link: string }
    return { postId: String(data.id), postUrl: data.link, featuredImageUploaded }
  }
}
