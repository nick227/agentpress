import Parser from 'rss-parser'
import type { FeedAdapter, FeedItem } from './FeedAdapter'

const parser = new Parser({ timeout: 10000 })

export class RssAdapter implements FeedAdapter {
  async resolveSource(sourceUrl: string): Promise<string | null> {
    try {
      await parser.parseURL(sourceUrl)
      return sourceUrl
    } catch {
      return null
    }
  }

  async fetchLatest(feedUrl: string, _sourceUrl: string): Promise<FeedItem[]> {
    const feed = await parser.parseURL(feedUrl)

    return (feed.items ?? []).slice(0, 20).map((item) => {
      const content = [item.contentSnippet, item.content, item.summary]
        .find((c) => c && c.trim().length > 0) ?? ''

      return {
        externalId: item.guid ?? item.link ?? item.title ?? `${feedUrl}-${item.pubDate}`,
        title: item.title ?? 'Untitled',
        itemUrl: item.link ?? feedUrl,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        content: content.slice(0, 8000),
      }
    })
  }
}
