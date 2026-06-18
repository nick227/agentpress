import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { db } from '@project/db'

export class OutputAssetService {
  private root: string

  constructor() {
    this.root = resolve(process.env.OUTPUT_ROOT ?? './outputs')
  }

  getRunFolder(accountSlug: string, pipelineSlug: string, runId: string): string {
    const folder = join(this.root, accountSlug, pipelineSlug, runId)
    mkdirSync(folder, { recursive: true })
    return folder
  }

  async saveImageFromUrl(input: {
    runId: string
    accountSlug: string
    pipelineSlug: string
    imageUrl: string
    relativePath: string
    label: string
  }): Promise<{ path: string; relativePath: string } | null> {
    try {
      const folder = this.getRunFolder(input.accountSlug, input.pipelineSlug, input.runId)
      const absolutePath = join(folder, input.relativePath)
      mkdirSync(dirname(absolutePath), { recursive: true })

      const res = await fetch(input.imageUrl)
      if (!res.ok) return null

      writeFileSync(absolutePath, Buffer.from(await res.arrayBuffer()))
      await db.runAsset.create({
        data: {
          pipelineRunId: input.runId,
          type: 'image',
          label: input.label,
          filename: input.relativePath,
          path: absolutePath,
        },
      })

      return { path: absolutePath, relativePath: input.relativePath }
    } catch {
      return null
    }
  }

  async copyImageAsset(input: {
    runId: string
    accountSlug: string
    pipelineSlug: string
    sourcePath: string
    relativePath: string
    label: string
  }): Promise<{ path: string; relativePath: string } | null> {
    try {
      if (!existsSync(input.sourcePath)) return null
      const folder = this.getRunFolder(input.accountSlug, input.pipelineSlug, input.runId)
      const absolutePath = join(folder, input.relativePath)
      mkdirSync(dirname(absolutePath), { recursive: true })
      copyFileSync(input.sourcePath, absolutePath)
      await db.runAsset.create({
        data: {
          pipelineRunId: input.runId,
          type: 'image',
          label: input.label,
          filename: input.relativePath,
          path: absolutePath,
        },
      })
      return { path: absolutePath, relativePath: input.relativePath }
    } catch {
      return null
    }
  }

  async saveRunAssets(
    runId: string,
    accountSlug: string,
    pipelineSlug: string,
    generatedPost: {
      title: string
      excerpt: string
      thumbnailPrompt?: string
      thumbnailUrl?: string
      body: string
    },
    agentOutputs: Record<string, string>,
    publishResult?: unknown,
  ): Promise<{ folder: string; thumbnailLocalPath: string | null }> {
    const folder = this.getRunFolder(accountSlug, pipelineSlug, runId)

    const assets: Array<{ type: string; label: string; filename: string; path: string }> = []

    const mdContent = `# ${generatedPost.title}\n\n${generatedPost.excerpt}\n\n${generatedPost.body}`
    this._write(folder, 'post.md', mdContent)
    assets.push({ type: 'text', label: 'Post Markdown', filename: 'post.md', path: join(folder, 'post.md') })

    this._write(folder, 'post.json', JSON.stringify(generatedPost, null, 2))
    assets.push({ type: 'json', label: 'Post JSON', filename: 'post.json', path: join(folder, 'post.json') })

    if (generatedPost.thumbnailPrompt) {
      this._write(folder, 'thumbnail-prompt.txt', generatedPost.thumbnailPrompt)
      assets.push({ type: 'text', label: 'Thumbnail Prompt', filename: 'thumbnail-prompt.txt', path: join(folder, 'thumbnail-prompt.txt') })
    }

    this._write(folder, 'agent-outputs.json', JSON.stringify(agentOutputs, null, 2))
    assets.push({ type: 'json', label: 'Agent Outputs', filename: 'agent-outputs.json', path: join(folder, 'agent-outputs.json') })

    if (publishResult) {
      this._write(folder, 'publish-result.json', JSON.stringify(publishResult, null, 2))
      assets.push({ type: 'json', label: 'Publish Result', filename: 'publish-result.json', path: join(folder, 'publish-result.json') })
    }

    // Download thumbnail image from DALL-E URL immediately (URL expires ~1hr)
    let thumbnailLocalPath: string | null = null
    if (generatedPost.thumbnailUrl) {
      try {
        const res = await fetch(generatedPost.thumbnailUrl)
        if (res.ok) {
          const thumbPath = join(folder, 'thumbnail.png')
          writeFileSync(thumbPath, Buffer.from(await res.arrayBuffer()))
          assets.push({ type: 'image', label: 'Thumbnail', filename: 'thumbnail.png', path: thumbPath })
          thumbnailLocalPath = thumbPath
        }
      } catch {
        // download failure is non-fatal
      }
    }

    await db.runAsset.createMany({
      data: assets.map((a) => ({
        pipelineRunId: runId,
        type: a.type,
        label: a.label,
        filename: a.filename,
        path: a.path,
      })),
    })

    await db.pipelineRun.update({
      where: { id: runId },
      data: { outputFolder: folder },
    })

    return { folder, thumbnailLocalPath }
  }

  private _write(folder: string, filename: string, content: string) {
    writeFileSync(join(folder, filename), content, 'utf-8')
  }
}
