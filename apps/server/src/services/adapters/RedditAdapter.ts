import type { FeedAdapter, FeedItem } from './FeedAdapter'
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 10000 })
const DEFAULT_USER_AGENT = 'AgentPress/1.0 research-aggregator'

let accessToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value

  const clientId = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_SECRET
  if (!clientId || !secret) return null

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT ?? DEFAULT_USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null

  const json: any = await res.json()
  if (!json.access_token) return null

  accessToken = {
    value: json.access_token,
    expiresAt: Date.now() + Math.max(1, Number(json.expires_in ?? 3600) - 60) * 1000,
  }
  return accessToken.value
}

export class RedditAdapter implements FeedAdapter {
  async resolveSource(sourceUrl: string): Promise<string | null> {
    const value = sourceUrl.trim()
    const redditPath = value.match(/(?:^|\/)r\/([a-zA-Z0-9_]+)(?:\/|$)/)
    if (redditPath) return redditPath[1]!.toLowerCase()

    const bareSubreddit = value.match(/^\/?([a-zA-Z0-9_]{2,21})\/?$/)
    return bareSubreddit ? bareSubreddit[1]!.toLowerCase() : null
  }

  async fetchLatest(subreddit: string, _sourceUrl: string): Promise<FeedItem[]> {
    const today = new Date().toISOString().slice(0, 10)
    const token = await getAccessToken()
    if (token) {
      try {
        const items = await this.fetchLatestViaApi(subreddit, today, token)
        if (items.length > 0) return items
      } catch {
        // Fall back to RSS; ResearchService caches the final outcome.
      }
    }

    return this.fetchLatestViaRss(subreddit, today)
  }

  private async fetchLatestViaApi(subreddit: string, today: string, token: string): Promise<FeedItem[]> {
    const url = `https://oauth.reddit.com/r/${subreddit}/top?t=day&limit=25&sort=top`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT ?? DEFAULT_USER_AGENT,
      },
    })
    if (!res.ok) throw new Error(`Reddit returned ${res.status} for r/${subreddit}`)

    const json: any = await res.json()
    const posts: any[] = (json.data?.children ?? [])
      .map((child: any) => child.data)
      .filter((post: any) => post?.title && !post.stickied)

    return this.toDigest(subreddit, today, posts.slice(0, 15).map((post) => {
      const body = post.selftext?.trim()
      const snippet = body && body !== '[removed]' && body !== '[deleted]' ? body.slice(0, 600) : ''
      return {
        title: `${post.title} (↑${post.score ?? 0})`,
        url: `https://reddit.com${post.permalink}`,
        snippet,
      }
    }))
  }

  private async fetchLatestViaRss(subreddit: string, today: string): Promise<FeedItem[]> {
    const url = `https://www.reddit.com/r/${subreddit}/top/.rss?t=day`

    const res = await fetch(url, {
      headers: { 'User-Agent': process.env.REDDIT_USER_AGENT ?? DEFAULT_USER_AGENT },
    })
    if (!res.ok) throw new Error(`Reddit returned ${res.status} for r/${subreddit}`)

    const feed = await parser.parseString(await res.text())
    const posts = (feed.items ?? []).filter((item) => item.title)

    return this.toDigest(subreddit, today, posts.slice(0, 15).map((item) => {
      const snippet = [item.contentSnippet, item.content]
        .find((text) => text && text.trim().length > 0)
        ?.replace(/\s+/g, ' ')
        .slice(0, 600)
      return {
        title: item.title ?? 'Untitled',
        url: item.link ?? `https://www.reddit.com/r/${subreddit}`,
        snippet: snippet ?? '',
      }
    }))
  }

  private toDigest(subreddit: string, today: string, posts: Array<{ title: string; url: string; snippet?: string }>): FeedItem[] {
    if (posts.length === 0) return []

    const lines = posts.map((post) => `### ${post.title}\n${post.url}${post.snippet ? `\n${post.snippet}` : ''}`)

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
