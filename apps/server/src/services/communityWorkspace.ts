import { db } from '@project/db'

let _id: string | null | undefined

export async function getCommunityWorkspaceId(): Promise<string | null> {
  if (_id !== undefined) return _id
  const ws = await db.workspace.findFirst({ where: { type: 'COMMUNITY' }, select: { id: true } })
  _id = ws?.id ?? null
  return _id
}
