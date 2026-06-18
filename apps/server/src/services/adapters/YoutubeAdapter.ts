import type { FeedAdapter, FeedItem } from './FeedAdapter'
import { YoutubeService } from '../YoutubeService'
import { fetchYoutubeTranscript } from '../youtube/youtubeTranscript'

const yt = new YoutubeService()

async function fetchTranscriptText(videoId: string): Promise<string> {
  const result = await fetchYoutubeTranscript(videoId)
  return result.ok ? result.text : ''
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
      const [meta, content] = await Promise.all([
        yt.getVideoMetadata(videoId),
        fetchTranscriptText(videoId),
      ])
      if (!meta) return []

      return [
        {
          externalId: videoId,
          title: meta.title,
          itemUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: meta.publishedAt,
          content,
        },
      ]
    }

    const latest = await yt.getLatestVideo(channelId)
    if (!latest) return []

    const content = await fetchTranscriptText(latest.videoId)

    return [
      {
        externalId: latest.videoId,
        title: latest.title,
        itemUrl: `https://www.youtube.com/watch?v=${latest.videoId}`,
        publishedAt: latest.publishedAt,
        content,
      },
    ]
  }
}
