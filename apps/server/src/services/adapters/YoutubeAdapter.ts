import type { FeedAdapter, FeedItem } from './FeedAdapter'
import { YoutubeService } from '../YoutubeService'
import { contentFieldsFromTranscript } from '../researchContentStatus'
import { fetchYoutubeTranscript } from '../youtube/youtubeTranscript'

const yt = new YoutubeService()

async function buildFeedItem(videoId: string, title: string, publishedAt: Date): Promise<FeedItem> {
  const fields = contentFieldsFromTranscript(await fetchYoutubeTranscript(videoId))
  return {
    externalId: videoId,
    title,
    itemUrl: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt,
    content: fields.content ?? '',
    contentStatus: fields.contentStatus,
    contentErrorReason: fields.contentErrorReason,
  }
}

export class YoutubeAdapter implements FeedAdapter {
  async resolveSource(sourceUrl: string): Promise<string | null> {
    const videoId = yt.resolveVideoId(sourceUrl)
    if (videoId) return `VIDEO:${videoId}`

    return yt.resolveChannelId(sourceUrl).catch(() => null)
  }

  async fetchLatest(channelId: string, _sourceUrl: string): Promise<FeedItem[]> {
    if (channelId.startsWith('VIDEO:')) {
      const videoId = channelId.slice(6)
      const [meta, item] = await Promise.all([
        yt.getVideoMetadata(videoId),
        buildFeedItem(videoId, '', new Date()),
      ])
      if (!meta) return []

      return [{ ...item, title: meta.title, publishedAt: meta.publishedAt }]
    }

    const latest = await yt.getLatestVideo(channelId)
    if (!latest) return []

    return [await buildFeedItem(latest.videoId, latest.title, latest.publishedAt)]
  }
}
