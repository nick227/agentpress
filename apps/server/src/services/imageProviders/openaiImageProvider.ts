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
  return process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1'
}

function isGptImageModel(model: string): boolean {
  return model.startsWith('gpt-image')
}

function resolveDalleSize(model: string): DalleSize {
  const allowed = DALLE_SIZES[model] ?? DALLE_SIZES['dall-e-2']!
  const requested = process.env.OPENAI_IMAGE_SIZE
  if (requested && allowed.includes(requested)) return requested as DalleSize
  return allowed[0] as DalleSize
}

function resolveGptImageSize(): GptImageSize {
  const requested = process.env.OPENAI_IMAGE_SIZE
  if (requested && GPT_IMAGE_SIZES.includes(requested as GptImageSize)) {
    return requested as GptImageSize
  }
  return '1024x1024'
}

function toDataUrl(b64: string, mime = 'image/png'): string {
  return `data:${mime};base64,${b64}`
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = 'openai'

  async generate(options: ImageGenerateOptions): Promise<ImageGenerateResult | null> {
    const model = resolveModel()

    if (isGptImageModel(model)) {
      const response = await getClient().images.generate({
        model,
        prompt: options.prompt,
        size: resolveGptImageSize(),
        output_format: 'png',
      })
      const b64 = response.data?.[0]?.b64_json
      return b64 ? { url: toDataUrl(b64) } : null
    }

    const response = await getClient().images.generate({
      model,
      prompt: options.prompt,
      n: 1,
      size: resolveDalleSize(model),
      response_format: 'b64_json',
    })
    const image = response.data?.[0]
    const b64 = image?.b64_json
    if (b64) return { url: toDataUrl(b64) }
    return image?.url ? { url: image.url } : null
  }
}

/** @deprecated Use OpenAIImageProvider */
export class DalleProvider extends OpenAIImageProvider {
  readonly id = 'dalle'
}
