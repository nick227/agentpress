import OpenAI from 'openai'
import type { ImageGenerateOptions, ImageGenerateResult, ImageProvider } from './types'

const MODEL_SIZES: Record<string, readonly string[]> = {
  'dall-e-2': ['256x256', '512x512', '1024x1024'],
  'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
}

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

function resolveModel(): string {
  return process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-2'
}

function resolveSize(model: string): string {
  const allowed = MODEL_SIZES[model] ?? MODEL_SIZES['dall-e-2']!
  const requested = process.env.OPENAI_IMAGE_SIZE
  if (requested && allowed.includes(requested)) return requested
  return allowed[0]!
}

export class DalleProvider implements ImageProvider {
  readonly id = 'dalle'

  async generate(options: ImageGenerateOptions): Promise<ImageGenerateResult | null> {
    const model = resolveModel()
    const response = await getClient().images.generate({
      model,
      prompt: options.prompt,
      n: 1,
      size: resolveSize(model) as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
    })
    const image = response.data?.[0]
    const url = image?.url ?? (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : undefined)
    return url ? { url } : null
  }
}
