import { DalleProvider } from './dalleProvider'
import type { ImageProvider } from './types'

const providers: Record<string, ImageProvider> = {
  dalle: new DalleProvider(),
}

export function getImageProvider(): ImageProvider {
  const id = process.env.IMAGE_PROVIDER ?? 'dalle'
  const provider = providers[id]
  if (!provider) throw new Error(`Unknown image provider: ${id}`)
  return provider
}

export function getImageModelLabel(): string {
  const provider = process.env.IMAGE_PROVIDER ?? 'dalle'
  if (provider === 'dalle') {
    return process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-2'
  }
  return provider
}

export type { ImageProvider, ImageGenerateOptions, ImageGenerateResult } from './types'
