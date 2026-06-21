import { db } from '@project/db'
import type { AuthContext } from './AuthorizationService'
import { PromptService } from './PromptService'

type ContentPromptInput = {
  name: string
  description?: string
  systemPrompt: string
  userPrompt: string
  isDefault?: boolean
  sortOrder?: number
}

function toSummaryShape(prompt: {
  id: string
  name: string
  description: string | null | undefined
  systemPrompt: string
  userPrompt: string
  isDefault: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: prompt.id,
    name: prompt.name,
    description: prompt.description ?? undefined,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    isDefault: prompt.isDefault,
    sortOrder: prompt.sortOrder,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
  }
}

const promptSvc = new PromptService()

export class SummaryPromptService {
  async list(context: AuthContext) {
    const prompts = await promptSvc.list(context, { kind: 'CONTENT' })
    return prompts
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(toSummaryShape)
  }

  async create(context: AuthContext, data: ContentPromptInput) {
    const prompt = await promptSvc.create(context, {
      ...data,
      kind: 'CONTENT',
      category: 'research',
      tags: ['summary', 'research'],
    })
    return toSummaryShape({
      ...prompt,
      description: prompt.description ?? null,
    })
  }

  async update(context: AuthContext, promptId: string, data: Partial<ContentPromptInput>) {
    const prompt = await promptSvc.update(context, promptId, data)
    return toSummaryShape({
      ...prompt,
      description: prompt.description ?? null,
    })
  }

  async delete(context: AuthContext, promptId: string) {
    const existing = await db.prompt.findFirst({
      where: { id: promptId, kind: 'CONTENT' },
    })
    if (!existing) throw Object.assign(new Error('Prompt not found'), { statusCode: 404 })
    await promptSvc.delete(context, promptId)
  }
}
