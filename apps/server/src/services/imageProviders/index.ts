import { OpenAIImageProvider, resolveImageModel } from './openaiImageProvider'
import type { ImageProvider } from './types'

const openaiImageProvider = new OpenAIImageProvider()

const providers: Record<string, ImageProvider> = {
  openai: openaiImageProvider,
  dalle: openaiImageProvider,
}

export function getImageProvider(): ImageProvider {
  const id = process.env.IMAGE_PROVIDER ?? 'openai'
  const provider = providers[id]
  if (!provider) throw new Error(`Unknown image provider: ${id}`)
  return provider
}

export function getImageModelLabel(): string {
  return resolveImageModel()
}

export { resolveImageModel }
export type { ImageProvider } from './types'
