import { db } from '@project/db'
import { encrypt } from './PipelineRunService'

function formatDestination(d: any) {
  return {
    id: d.id,
    accountId: d.accountId,
    type: d.type,
    name: d.name,
    siteUrl: d.siteUrl,
    authType: d.authType,
    username: d.username ?? undefined,
    defaultStatus: d.defaultStatus,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export class DestinationService {
  async list(accountId: string) {
    const destinations = await db.destination.findMany({ where: { accountId }, orderBy: { name: 'asc' } })
    return destinations.map(formatDestination)
  }

  async create(accountId: string, data: { name: string; siteUrl: string; username?: string; secret: string; defaultStatus?: 'draft' | 'publish' }) {
    const d = await db.destination.create({
      data: {
        accountId,
        name: data.name,
        siteUrl: data.siteUrl,
        username: data.username,
        encryptedSecret: encrypt(data.secret),
        defaultStatus: data.defaultStatus ?? 'draft',
      },
    })
    return formatDestination(d)
  }

  async delete(destinationId: string) {
    await db.destination.delete({ where: { id: destinationId } })
  }
}
