import { db } from '@project/db'

export class SummaryPromptService {
  async list() {
    return db.summaryPrompt.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  }

  async create(data: {
    name: string
    description?: string
    systemPrompt: string
    userPrompt: string
    isDefault?: boolean
    sortOrder?: number
  }) {
    return db.summaryPrompt.create({ data })
  }

  async update(
    promptId: string,
    data: {
      name?: string
      description?: string
      systemPrompt?: string
      userPrompt?: string
      isDefault?: boolean
      sortOrder?: number
    },
  ) {
    return db.summaryPrompt.update({ where: { id: promptId }, data })
  }

  async delete(promptId: string) {
    await db.summaryPrompt.delete({ where: { id: promptId } })
  }
}
