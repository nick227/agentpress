import { readFileSync } from 'fs'
import { mimeTypeForAsset } from './OutputAssetService'

export type WordPressCredentials = {
  siteUrl: string
  username: string
  appPassword: string
}

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
  localPath: string
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
    return `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`
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
    const contentType = mimeTypeForAsset(filename)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(credentials),
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: imageBuffer as unknown as BodyInit,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WordPress media upload failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as { id: number; source_url?: string; guid?: { rendered?: string } }
    const mediaId = data.id
    const mediaUrl = data.source_url ?? data.guid?.rendered ?? ''

    if (meta && (meta.alt || meta.caption || meta.title)) {
      await this.updateMediaMeta(credentials, mediaId, meta)
    }

    return { id: mediaId, url: mediaUrl }
  }

  private async updateMediaMeta(
    credentials: WordPressCredentials,
    mediaId: number,
    meta: { alt?: string; caption?: string; title?: string },
  ): Promise<void> {
    const url = `${this.apiBase(credentials.siteUrl)}/media/${mediaId}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(meta.alt ? { alt_text: meta.alt } : {}),
        ...(meta.caption ? { caption: meta.caption } : {}),
        ...(meta.title ? { title: meta.title } : {}),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WordPress media metadata update failed (${response.status}): ${body}`)
    }
  }

  async uploadInlineImages(
    credentials: WordPressCredentials,
    body: string,
    images: InlineImageUploadInput[],
  ): Promise<UploadInlineImagesResult> {
    const uploads = await Promise.all(images.map(async (image) => {
      if (!image.localPath || !image.relativePath) {
        return { image, error: image.relativePath || 'unknown image' }
      }

      try {
        const result = await this.uploadMedia(
          credentials,
          readFileSync(image.localPath),
          image.filename,
          { alt: image.alt, caption: image.caption, title: image.alt },
        )
        return { image, result }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { image, error: `${image.relativePath}: ${message}` }
      }
    }))

    let nextBody = body
    const uploaded: InlineImageUploadResult[] = []
    const failed: string[] = []

type UploadAttempt = { image: InlineImageUploadInput; result: { id: number; url: string } } | { image: InlineImageUploadInput; error: string }

    for (const upload of uploads as UploadAttempt[]) {
      if ('error' in upload) {
        failed.push(upload.error)
        continue
      }

      const { image, result } = upload
      nextBody = this.rewriteInlineImageSrc(nextBody, image.relativePath, result.url)
      uploaded.push({
        relativePath: image.relativePath,
        mediaId: result.id,
        url: result.url,
      })
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
  ): Promise<{ postId: string; postUrl: string }> {
    const url = `${this.apiBase(credentials.siteUrl)}/posts`

    let featuredMediaId: number | undefined
    if (thumbnailBuffer) {
      try {
        featuredMediaId = await this.uploadMedia(
          credentials,
          thumbnailBuffer,
          'thumbnail.png',
          { title: post.title, alt: post.title },
        ).then((media) => media.id)
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
    return { postId: String(data.id), postUrl: data.link }
  }
}
