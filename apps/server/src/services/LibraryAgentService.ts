import { db } from '@project/db'
import { createHash } from 'crypto'

function promptHash(systemPrompt: string, userPrompt: string, outputTarget: string): string {
  return createHash('sha256').update(`${systemPrompt}|||${userPrompt}|||${outputTarget}`).digest('hex')
}

function formatAgent(a: any) {
  return {
    id: a.id,
    uid: a.uid,
    name: a.name,
    description: a.description ?? undefined,
    category: a.category,
    tags: (a.tags as string[]) ?? [],
    systemPrompt: a.systemPrompt,
    userPrompt: a.userPrompt,
    outputTarget: a.outputTarget,
    outputFormat: a.outputFormat,
    promptHash: a.promptHash,
    usageCount: a.usageCount,
    sourceRunId: a.sourceRunId ?? undefined,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

export class LibraryAgentService {
  async list(category?: string, search?: string) {
    const agents = await db.libraryAgent.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return agents.map(formatAgent)
  }

  async get(id: string) {
    const a = await db.libraryAgent.findUnique({ where: { id } })
    return a ? formatAgent(a) : null
  }

  async create(data: {
    uid: string
    name: string
    description?: string
    category: string
    tags?: string[]
    systemPrompt: string
    userPrompt: string
    outputTarget: string
    outputFormat?: string
  }) {
    const hash = promptHash(data.systemPrompt, data.userPrompt, data.outputTarget)
    const existing = await db.libraryAgent.findUnique({ where: { promptHash: hash } })
    if (existing) return formatAgent(existing)

    const a = await db.libraryAgent.create({
      data: {
        uid: data.uid,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags ?? [],
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        outputTarget: data.outputTarget,
        outputFormat: data.outputFormat ?? 'text',
        promptHash: hash,
        usageCount: 0,
      },
    })
    return formatAgent(a)
  }

  async update(
    id: string,
    data: Partial<{
      uid: string
      name: string
      description: string
      category: string
      tags: string[]
      systemPrompt: string
      userPrompt: string
      outputTarget: string
      outputFormat: string
    }>,
  ) {
    const existing = await db.libraryAgent.findUnique({ where: { id } })
    if (!existing) throw Object.assign(new Error('Agent not found'), { statusCode: 404 })

    const newSystemPrompt = data.systemPrompt ?? existing.systemPrompt
    const newUserPrompt = data.userPrompt ?? existing.userPrompt
    const newOutputTarget = data.outputTarget ?? existing.outputTarget
    const newHash = promptHash(newSystemPrompt, newUserPrompt, newOutputTarget)

    const a = await db.libraryAgent.update({
      where: { id },
      data: {
        ...data,
        tags: data.tags ?? undefined,
        promptHash: newHash,
      },
    })
    return formatAgent(a)
  }

  async delete(id: string) {
    await db.libraryAgent.delete({ where: { id } })
  }

  async promoteFromRun(pipeline: any) {
    for (const agent of pipeline.agents ?? []) {
      const hash = promptHash(agent.systemPrompt, agent.userPrompt, agent.outputTarget)
      await db.libraryAgent.upsert({
        where: { promptHash: hash },
        update: { usageCount: { increment: 1 } },
        create: {
          uid: agent.uid,
          name: agent.name,
          description: `Used in "${pipeline.name}"`,
          category: 'promoted',
          tags: [],
          systemPrompt: agent.systemPrompt,
          userPrompt: agent.userPrompt,
          outputTarget: agent.outputTarget,
          outputFormat: agent.outputFormat ?? 'text',
          promptHash: hash,
          usageCount: 1,
        },
      })
    }
  }
}
