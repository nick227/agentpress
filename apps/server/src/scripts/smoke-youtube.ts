import { YoutubeService } from '../services/YoutubeService'

const yt = new YoutubeService()

async function step(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  process.stdout.write(`  ${label}... `)
  try {
    const result = await fn()
    console.log('✓')
    return result
  } catch (err: any) {
    console.log(`✗  ${err.message}`)
    return null
  }
}

async function main() {
  console.log('\nYouTube transcript smoke test — @Vaush\n')

  const channelId = await step(
    'Resolve @Vaush handle → channelId',
    () => yt.resolveChannelId('https://www.youtube.com/@Vaush').then((id) => {
      if (!id) throw new Error('channelId is null')
      console.log(`     channelId: ${id}`)
      return id
    }),
  ) as string | null

  if (!channelId) {
    console.log('\n  Channel resolution failed — aborting.\n')
    process.exit(1)
  }

  const video = await step(
    'Fetch latest video via RSS',
    () => yt.getLatestVideo(channelId!).then((v) => {
      if (!v) throw new Error('no video returned from RSS')
      console.log(`     video: "${v.title}" (${v.videoId})`)
      console.log(`     published: ${v.publishedAt.toISOString()}`)
      return v
    }),
  ) as { videoId: string; title: string; publishedAt: Date } | null

  if (!video) {
    console.log('\n  RSS fetch failed — aborting.\n')
    process.exit(1)
  }

  const transcript = await step(
    `Fetch transcript for ${video.videoId}`,
    () => yt.fetchTranscript(video.videoId).then((t) => {
      if (!t) throw new Error('transcript is null')
      const words = t.split(/\s+/).length
      const chars = t.length
      console.log(`     ${words} words, ${chars} chars`)
      console.log(`     preview: "${t.slice(0, 120).replace(/\n/g, ' ')}…"`)
      return t
    }),
  )

  console.log()
  if (transcript) {
    console.log('All steps passed ✓\n')
  } else {
    console.log('Transcript unavailable (video may have no captions) — channel resolution and RSS work.\n')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
