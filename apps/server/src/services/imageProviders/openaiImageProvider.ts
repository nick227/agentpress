import OpenAI from 'openai'
import type { ImageGenerateOptions, ImageGenerateResult, ImageProvider } from './types'

const DALLE_SIZES: Record<string, readonly string[]> = {
  'dall-e-2': ['256x256', '512x512', '1024x1024'],
  'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
}

const GPT_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto'] as const

type GptImageSize = (typeof GPT_IMAGE_SIZES)[number]
type DalleSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

function resolveModel(): string {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim()
  return raw || 'gpt-image-1'
}

function normalizeModel(model: string): string {
  return model.trim().toLowerCase()
}

function isDalleModel(model: string): boolean {
  const m = normalizeModel(model)
  return m === 'dall-e-2' || m === 'dall-e-3'
}

function resolveDalleSize(model: string): DalleSize {
  const allowed = DALLE_SIZES[normalizeModel(model)] ?? DALLE_SIZES['dall-e-2']!
  const requested = process.env.OPENAI_IMAGE_SIZE?.trim()
  if (requested && allowed.includes(requested)) return requested as DalleSize
  return allowed[0] as DalleSize
}

function resolveGptImageSize(): GptImageSize {
  const requested = process.env.OPENAI_IMAGE_SIZE?.trim()
  if (requested && GPT_IMAGE_SIZES.includes(requested as GptImageSize)) {
    return requested as GptImageSize
  }
  return '1024x1024'
}

function toDataUrl(b64: string, mime = 'image/png'): string {
  return `data:${mime};base64,${b64}`
}

function resultFromResponse(data: OpenAI.Images.ImagesResponse['data']): ImageGenerateResult | null {
  const image = data?.[0]
  if (!image) return null
  if (image.b64_json) return { url: toDataUrl(image.b64_json) }
  return image.url ? { url: image.url } : null
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = 'openai'

  async generate(options: ImageGenerateOptions): Promise<ImageGenerateResult | null> {
    const model = resolveModel()

    if (isDalleModel(model)) {
      const response = await getClient().images.generate({
        model: normalizeModel(model),
        prompt: options.prompt,
        n: 1,
        size: resolveDalleSize(model),
        response_format: 'url',
      })
      return resultFromResponse(response.data)
    }

    // gpt-image-1 and newer OpenAI image models reject response_format.
    const response = await getClient().images.generate({
      model: normalizeModel(model),
      prompt: options.prompt,
      size: resolveGptImageSize(),
    })
    return resultFromResponse(response.data)
  }
}

/** @deprecated Use OpenAIImageProvider */
export class DalleProvider extends OpenAIImageProvider {
  readonly id = 'dalle'
}
