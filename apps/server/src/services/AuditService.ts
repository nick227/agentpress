import { db } from '@project/db'

export const audit = {
  record(input: {
    workspaceId: string
    actorUserId?: string | null
    action: string
    targetType: string
    targetId: string
    metadata?: Record<string, unknown>
  }) {
    return db.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as any,
      },
    })
  },
}
