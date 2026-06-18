import { db, Prisma } from '@project/db'
import { encrypt, decrypt } from './PipelineRunService'
import { WordPressService } from './WordPressService'

const wp = new WordPressService()

function parseCategoryIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
}

function formatDestination(d: {
  id: string
  accountId: string
  type: string
  name: string
  siteUrl: string
  authType: string
  username: string | null
  defaultStatus: string
  defaultCategoryIds: unknown
  createdAt: Date
  updatedAt: Date
}) {
  const defaultCategoryIds = parseCategoryIds(d.defaultCategoryIds)
  return {
    id: d.id,
    accountId: d.accountId,
    type: d.type,
    name: d.name,
    siteUrl: d.siteUrl,
    authType: d.authType,
    username: d.username ?? undefined,
    defaultStatus: d.defaultStatus,
    defaultCategoryIds: defaultCategoryIds.length > 0 ? defaultCategoryIds : undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export class DestinationService {
  async list(accountId: string) {
    const destinations = await db.destination.findMany({ where: { accountId }, orderBy: { name: 'asc' } })
    return destinations.map(formatDestination)
  }

  async create(accountId: string, data: {
    name: string
    siteUrl: string
    username?: string
    secret: string
    defaultStatus?: 'draft' | 'publish'
    defaultCategoryIds?: number[]
  }) {
    const d = await db.destination.create({
      data: {
        accountId,
        name: data.name,
        siteUrl: data.siteUrl,
        username: data.username,
        encryptedSecret: encrypt(data.secret),
        defaultStatus: data.defaultStatus ?? 'draft',
        defaultCategoryIds: data.defaultCategoryIds?.length ? data.defaultCategoryIds : undefined,
      },
    })
    return formatDestination(d)
  }

  async update(destinationId: string, data: {
    name?: string
    defaultStatus?: 'draft' | 'publish'
    defaultCategoryIds?: number[] | null
  }) {
    const d = await db.destination.update({
      where: { id: destinationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.defaultStatus !== undefined ? { defaultStatus: data.defaultStatus } : {}),
        ...(data.defaultCategoryIds !== undefined
          ? {
              defaultCategoryIds: data.defaultCategoryIds && data.defaultCategoryIds.length > 0
                ? data.defaultCategoryIds
                : Prisma.DbNull,
            }
          : {}),
      },
    })
    return formatDestination(d)
  }

  async listWordPressCategories(destinationId: string) {
    const destination = await db.destination.findUnique({ where: { id: destinationId } })
    if (!destination) throw Object.assign(new Error('Destination not found'), { statusCode: 404 })

    const categories = await wp.listCategories({
      siteUrl: destination.siteUrl,
      username: destination.username ?? '',
      appPassword: decrypt(destination.encryptedSecret),
    })

    return categories
  }

  async delete(destinationId: string) {
    await db.destination.delete({ where: { id: destinationId } })
  }
}
