import { db, Prisma } from '@project/db'
import { encrypt, decrypt } from './PipelineRunService'
import { WordPressService } from './WordPressService'
import { parseCategoryIds } from './serviceUtils'

const wp = new WordPressService()

function formatDestination(d: {
  id: string
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
  async get(destinationId: string) {
    const destination = await db.destination.findUnique({ where: { id: destinationId } })
    return destination ? formatDestination(destination) : null
  }

  async list() {
    const destinations = await db.destination.findMany({ orderBy: { name: 'asc' } })
    return destinations.map(formatDestination)
  }

  async create(data: {
    name: string
    siteUrl: string
    username?: string
    secret: string
    defaultStatus?: 'draft' | 'publish'
    defaultCategoryIds?: number[]
  }) {
    const d = await db.destination.create({
      data: {
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
    siteUrl?: string
    username?: string
    secret?: string
    defaultStatus?: 'draft' | 'publish'
    defaultCategoryIds?: number[] | null
  }) {
    const d = await db.destination.update({
      where: { id: destinationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.siteUrl !== undefined ? { siteUrl: data.siteUrl } : {}),
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.secret ? { encryptedSecret: encrypt(data.secret) } : {}),
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
    const publishAttempts = await db.publishAttempt.count({ where: { destinationId } })
    if (publishAttempts > 0) {
      throw Object.assign(new Error('This destination has publish history and cannot be deleted'), { statusCode: 409 })
    }
    await db.$transaction([
      db.pipeline.updateMany({ where: { destinationId }, data: { destinationId: null } }),
      db.destination.delete({ where: { id: destinationId } }),
    ])
  }
}
