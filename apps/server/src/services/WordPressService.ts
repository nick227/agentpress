export class WordPressService {
  async uploadMedia(
    siteUrl: string,
    username: string,
    appPassword: string,
    imageBuffer: Uint8Array,
    filename = 'thumbnail.png',
  ): Promise<{ id: number; url: string }> {
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`
    const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: imageBuffer as unknown as BodyInit,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WordPress media upload failed (${response.status}): ${body}`)
    }

    const data: any = await response.json()
    return { id: data.id as number, url: data.source_url ?? data.guid?.rendered ?? '' }
  }

  async publish(
    siteUrl: string,
    username: string,
    appPassword: string,
    post: { title: string; excerpt: string; content: string; status: 'draft' | 'publish' },
    thumbnailBuffer?: Uint8Array,
  ): Promise<{ postId: string; postUrl: string }> {
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`
    const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64')

    let featuredMediaId: number | undefined
    if (thumbnailBuffer) {
      try {
        featuredMediaId = await this.uploadMedia(siteUrl, username, appPassword, thumbnailBuffer)
          .then((media) => media.id)
      } catch {
        // media upload failure is non-fatal — post still publishes without thumbnail
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        status: post.status,
        ...(featuredMediaId !== undefined ? { featured_media: featuredMediaId } : {}),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WordPress publish failed (${response.status}): ${body}`)
    }

    const data: any = await response.json()
    return { postId: String(data.id), postUrl: data.link }
  }
}
