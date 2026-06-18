import OpenAI from 'openai'
import { getImageProvider } from './imageProviders'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export class OpenAIService {
  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    const model = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o'
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    return response.choices[0]?.message?.content ?? ''
  }

  async generateImage(prompt: string): Promise<string | null> {
    const result = await getImageProvider().generate({ prompt })
    return result?.url ?? null
  }
}
