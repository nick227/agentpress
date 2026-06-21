import { db } from '@project/db'

export type SummaryPromptRef = {
  id: string
  name: string
}

export async function resolveGlobalDefaultSummaryPrompt(): Promise<SummaryPromptRef | null> {
  return db.prompt.findFirst({
    where: { kind: 'CONTENT' },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  })
}

export async function resolvePipelineSummaryPrompt(
  defaultSummaryPromptId?: string | null,
): Promise<SummaryPromptRef> {
  if (defaultSummaryPromptId) {
    const feedPrompt = await db.prompt.findFirst({
      where: { id: defaultSummaryPromptId, kind: 'CONTENT' },
      select: { id: true, name: true },
    })
    if (feedPrompt) return feedPrompt
  }

  const globalDefault = await resolveGlobalDefaultSummaryPrompt()
  if (!globalDefault) {
    throw new Error('No summary prompt is available for research interpolation')
  }
  return globalDefault
}
