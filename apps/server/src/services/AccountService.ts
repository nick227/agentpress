import { db } from '@project/db'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let suffix = 0
  while (true) {
    const existing = await db.account.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    suffix++
    slug = `${base}-${suffix}`
  }
}

export class AccountService {
  async list() {
    const accounts = await db.account.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { pipelines: true } },
        pipelines: {
          select: { runs: { select: { startedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    })

    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      category: a.category ?? undefined,
      phone: a.phone ?? undefined,
      email: a.email ?? undefined,
      description: a.description ?? undefined,
      pipelineCount: a._count.pipelines,
      lastRunAt: a.pipelines[0]?.runs[0]?.startedAt ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))
  }

  async get(accountId: string) {
    const a = await db.account.findFirst({ where: { OR: [{ id: accountId }, { slug: accountId }] } })
    if (!a) return null
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      category: a.category ?? undefined,
      phone: a.phone ?? undefined,
      email: a.email ?? undefined,
      description: a.description ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }
  }

  async create(data: { name: string; category?: string; phone?: string; email?: string; description?: string }) {
    const slug = await uniqueSlug(toSlug(data.name))
    return db.account.create({
      data: {
        name: data.name,
        slug,
        category: data.category,
        phone: data.phone,
        email: data.email,
        description: data.description,
      },
    })
  }

  async update(accountId: string, data: { name?: string; category?: string; phone?: string; email?: string; description?: string }) {
    return db.account.update({
      where: { id: accountId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    })
  }

  async delete(accountId: string) {
    await db.account.delete({ where: { id: accountId } })
  }
}
