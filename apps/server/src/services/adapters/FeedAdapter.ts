import type { ContentStatus } from '../researchContentStatus'

export interface FeedItem {
  externalId: string
  title: string
  itemUrl: string
  publishedAt: Date
  content: string
  contentStatus?: ContentStatus
  contentErrorReason?: string | null
}

export interface FeedAdapter {
  resolveSource(sourceUrl: string): Promise<string | null>
  fetchLatest(externalId: string, sourceUrl: string): Promise<FeedItem[]>
}

export function getAdapter(sourceType: string): FeedAdapter {
  switch (sourceType) {
    case 'reddit': {
      const { RedditAdapter } = require('./RedditAdapter')
      return new RedditAdapter()
    }
    case 'rss': {
      const { RssAdapter } = require('./RssAdapter')
      return new RssAdapter()
    }
    default: {
      const { YoutubeAdapter } = require('./YoutubeAdapter')
      return new YoutubeAdapter()
    }
  }
}
