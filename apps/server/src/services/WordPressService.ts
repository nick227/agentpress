export class WordPressService {
  async publish(
    siteUrl: string,
    username: string,
    appPassword: string,
    post: { title: string; excerpt: string; content: string; status: 'draft' | 'publish' },
  ): Promise<{ postId: string; postUrl: string }> {
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`
    const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64')

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
