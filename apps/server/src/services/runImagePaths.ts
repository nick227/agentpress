import { existsSync } from 'fs'
import { join, resolve } from 'path'

export function resolveExistingPath(...candidates: Array<string | undefined | null>): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue
    const resolved = resolve(candidate)
    if (existsSync(resolved)) return resolved
  }
  return undefined
}

export function parseImageAssetId(url?: string): string | undefined {
  if (!url) return undefined
  return url.match(/\/api\/image-assets\/([^/]+)\/file/)?.[1]
}

export function runAssetPath(
  assets: Array<{ filename: string; path: string }>,
  relativePath: string,
): string | undefined {
  const asset = assets.find((item) => item.filename === relativePath)
  return asset?.path ? resolveExistingPath(asset.path) : undefined
}

export function outputFolderImagePath(outputFolder: string | undefined, relativePath: string | undefined): string | undefined {
  if (!outputFolder || !relativePath) return undefined
  return resolveExistingPath(join(outputFolder, relativePath))
}
