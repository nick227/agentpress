import type { FeedAdapter, FeedItem } from './FeedAdapter'

export class RedditAdapter implements FeedAdapter {
  async resolveSource(sourceUrl: string): Promise<string | null> {
    const match = sourceUrl.match(/r\/([a-zA-Z0-9_]+)/)
    return match ? match[1]!.toLowerCase() : null
  }

  async fetchLatest(subreddit: string, _sourceUrl: string): Promise<FeedItem[]> {
    const today = new Date().toISOString().slice(0, 10)
    const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=25&sort=top`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AgentPress/1.0 research-aggregator' },
    })
    if (!res.ok) throw new Error(`Reddit returned ${res.status} for r/${subreddit}`)

    const json: any = await res.json()
    const posts: any[] = (json.data?.children ?? [])
      .map((c: any) => c.data)
      .filter((d: any) => d?.title && !d.stickied)

    if (posts.length === 0) return []

    const lines = posts.slice(0, 15).map((d) => {
      const body = d.selftext?.trim()
      const snippet = body && body !== '[removed]' && body !== '[deleted]' ? `\n${body.slice(0, 600)}` : ''
      return `### ${d.title} (↑${d.score})\nhttps://reddit.com${d.permalink}${snippet}`
    })

    const content = `## r/${subreddit} — Top Posts ${today}\n\n${lines.join('\n\n')}`

    return [
      {
        externalId: `${subreddit}-${today}`,
        title: `r/${subreddit} Daily Digest — ${today}`,
        itemUrl: `https://www.reddit.com/r/${subreddit}/top/?t=day`,
        publishedAt: new Date(),
        content,
      },
    ]
  }
}
