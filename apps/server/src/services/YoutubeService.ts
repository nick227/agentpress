import { YoutubeTranscript } from 'youtube-transcript'

// Parses the RSS feed XML to get the most recent video
function parseLatestVideo(xml: string): { videoId: string; title: string; publishedAt: Date } | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/)
  if (!entryMatch) return null

  const entry = entryMatch[1]!
  const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
  const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
  const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)

  if (!videoIdMatch || !titleMatch || !publishedMatch) return null

  return {
    videoId: videoIdMatch[1]!,
    title: titleMatch[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    publishedAt: new Date(publishedMatch[1]!),
  }
}

export class YoutubeService {
  // Resolves a YouTube URL (@handle, /channel/, /c/, /user/) to a channel ID
  async resolveChannelId(url: string): Promise<string | null> {
    // Already a bare channel ID like UCxxxxxx
    const bareChannelMatch = url.match(/^UC[\w-]{21}[AQgw]$/)
    if (bareChannelMatch) return url

    // /channel/UCxxxxxx
    const channelPathMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/)
    if (channelPathMatch) return channelPathMatch[1]!

    // @handle, /c/handle, /user/handle — need to resolve via page HTML
    const pageUrl = url.startsWith('http') ? url : `https://www.youtube.com/${url}`
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      })
      const html = await res.text()
      const match = html.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)
      return match ? match[1]! : null
    } catch {
      return null
    }
  }

  // Returns the latest video from a channel via RSS feed
  async getLatestVideo(channelId: string): Promise<{ videoId: string; title: string; publishedAt: Date } | null> {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    try {
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      })
      if (!res.ok) return null
      const xml = await res.text()
      return parseLatestVideo(xml)
    } catch {
      return null
    }
  }

  // Fetches the transcript for a video ID and returns it as plain text
  async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId)
      return segments.map((s) => s.text).join(' ')
    } catch {
      return null
    }
  }
}
