import { PrismaClient, Prisma } from '@prisma/client'

declare global {
  var __db: PrismaClient | undefined
}

export const db = global.__db ?? new PrismaClient()
export { Prisma }
export type { PromptKind, Visibility, WorkspaceRole, WorkspaceType } from '@prisma/client'

if (process.env.NODE_ENV !== 'production') {
  global.__db = db
}
