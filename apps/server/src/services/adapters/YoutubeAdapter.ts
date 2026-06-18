import type { FeedAdapter, FeedItem } from './FeedAdapter'
import { YoutubeService } from '../YoutubeService'

const yt = new YoutubeService()

export class YoutubeAdapter implements FeedAdapter {
  async resolveSource(sourceUrl: string): Promise<string | null> {
    const videoId = yt.resolveVideoId(sourceUrl)
    if (videoId) return `VIDEO:${videoId}`

    return yt.resolveChannelId(sourceUrl).catch(() => null)
  }

  async fetchLatest(channelId: string, _sourceUrl: string): Promise<FeedItem[]> {
    if (channelId.startsWith('VIDEO:')) {
      const videoId = channelId.slice(6)
      const meta = await yt.getVideoMetadata(videoId)
      if (!meta) return []

      const content = await yt.fetchTranscript(videoId).catch(() => null)

      return [
        {
          externalId: videoId,
          title: meta.title,
          itemUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: meta.publishedAt,
          content: content ?? '',
        },
      ]
    }

    const latest = await yt.getLatestVideo(channelId)
    if (!latest) return []

    const content = await yt.fetchTranscript(latest.videoId).catch(() => null)

    return [
      {
        externalId: latest.videoId,
        title: latest.title,
        itemUrl: `https://www.youtube.com/watch?v=${latest.videoId}`,
        publishedAt: latest.publishedAt,
        content: content ?? '',
      },
    ]
  }
}
