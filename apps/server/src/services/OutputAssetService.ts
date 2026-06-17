import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { db } from '@project/db'

export class OutputAssetService {
  private root: string

  constructor() {
    this.root = resolve(process.env.OUTPUT_ROOT ?? './outputs')
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
  ) {
    const folder = join(this.root, accountSlug, pipelineSlug, runId)
    mkdirSync(folder, { recursive: true })

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

    return folder
  }

  private _write(folder: string, filename: string, content: string) {
    writeFileSync(join(folder, filename), content, 'utf-8')
  }
}
