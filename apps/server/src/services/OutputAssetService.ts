import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative, resolve, sep } from 'path'
import { db } from '@project/db'
import { buildPostHtml, type RunAgentPrompt } from './runArtifacts'

export type { RunAgentPrompt }

export function mimeTypeForAsset(filename: string): string {
  const base = basename(filename).toLowerCase()
  if (base.endsWith('.html')) return 'text/html; charset=utf-8'
  if (base.endsWith('.json')) return 'application/json; charset=utf-8'
  if (base.endsWith('.png')) return 'image/png'
  if (base.endsWith('.jpg') || base.endsWith('.jpeg')) return 'image/jpeg'
  if (base.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

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

  getImageAssetFolder(accountId: string): string {
    const folder = join(this.root, 'image-assets', accountId)
    mkdirSync(folder, { recursive: true })
    return folder
  }

  async saveImageAssetFromUrl(input: {
    accountId: string
    assetId: string
    imageUrl: string
    filename?: string
  }): Promise<{ path: string; filename: string } | null> {
    try {
      const filename = input.filename ?? `${input.assetId}.png`
      const absolutePath = join(this.getImageAssetFolder(input.accountId), filename)
      const buffer = await this.imageBuffer(input.imageUrl)
      if (!buffer) return null
      writeFileSync(absolutePath, buffer)
      return { path: absolutePath, filename }
    } catch {
      return null
    }
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

      const buffer = await this.imageBuffer(input.imageUrl)
      if (!buffer) return null

      writeFileSync(absolutePath, buffer)
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
      thumbnailLocalPath?: string
      body: string
    },
    agentPrompts: RunAgentPrompt[],
  ): Promise<{ folder: string; thumbnailLocalPath: string | null }> {
    const folder = this.getRunFolder(accountSlug, pipelineSlug, runId)
    const assets: Array<{ type: string; label: string; filename: string; path: string }> = []

    this._write(folder, 'agents.json', JSON.stringify(agentPrompts, null, 2))

    let thumbnailLocalPath: string | null = null
    if (generatedPost.thumbnailLocalPath && existsSync(generatedPost.thumbnailLocalPath)) {
      thumbnailLocalPath = generatedPost.thumbnailLocalPath
    } else if (generatedPost.thumbnailUrl) {
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

    const html = buildPostHtml({
      title: generatedPost.title,
      excerpt: generatedPost.excerpt,
      body: generatedPost.body,
      thumbnailLocalPath: thumbnailLocalPath ?? undefined,
    })
    const htmlPath = join(folder, 'post.html')
    this._write(folder, 'post.html', html)
    assets.push({ type: 'html', label: 'Post HTML', filename: 'post.html', path: htmlPath })

    if (assets.length > 0) {
      await db.runAsset.createMany({
        data: assets.map((a) => ({
          pipelineRunId: runId,
          type: a.type,
          label: a.label,
          filename: a.filename,
          path: a.path,
        })),
      })
    }

    await db.pipelineRun.update({
      where: { id: runId },
      data: { outputFolder: folder },
    })

    return { folder, thumbnailLocalPath }
  }

  async getAssetFile(runId: string, assetId: string): Promise<{ filename: string; buffer: Buffer } | null> {
    const asset = await db.runAsset.findFirst({
      where: { id: assetId, pipelineRunId: runId },
    })
    if (!asset || !existsSync(asset.path)) return null

    const resolved = resolve(asset.path)
    const root = resolve(this.root)
    const rel = relative(root, resolved)
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) return null

    return {
      filename: basename(asset.filename),
      buffer: readFileSync(resolved),
    }
  }

  async getImageAssetFile(assetId: string): Promise<{ filename: string; buffer: Buffer } | null> {
    const asset = await db.imageAsset.findUnique({ where: { id: assetId } })
    if (!asset || !existsSync(asset.path)) return null

    const resolved = resolve(asset.path)
    const root = resolve(this.root)
    const rel = relative(root, resolved)
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) return null

    return {
      filename: basename(asset.path),
      buffer: readFileSync(resolved),
    }
  }

  private async imageBuffer(imageUrl: string): Promise<Buffer | null> {
    if (imageUrl.startsWith('data:')) {
      return Buffer.from(imageUrl.split(',')[1] ?? '', 'base64')
    }
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }

  private _write(folder: string, filename: string, content: string) {
    writeFileSync(join(folder, filename), content, 'utf-8')
  }
}
