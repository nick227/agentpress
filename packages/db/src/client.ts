import { PrismaClient, Prisma } from '@prisma/client'

declare global {
  var __db: PrismaClient | undefined
}

export const db = global.__db ?? new PrismaClient()
export { Prisma }
export type { AgentKind, PromptKind, Visibility, WorkspaceRole, WorkspaceType } from '@prisma/client'
export {
  assertFeedReferencesValid,
  auditPromptReferences,
  classifyPromptReference,
  extractFeedSlugRefs,
  extractPromptReferences,
  normalizePromptReference,
  RESEARCH_FEED_FIELDS,
} from './promptReferences'
export type {
  ClassifiedPromptReference,
  PromptReferenceIssue,
  PromptReferenceKind,
} from './promptReferences'

if (process.env.NODE_ENV !== 'production') {
  global.__db = db
}
