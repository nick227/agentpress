import { db } from '@project/db'
import type { Visibility, WorkspaceRole, WorkspaceType } from '@project/db'

export type AuthContext = {
  userId: string
  workspaceId: string
  workspaceType: WorkspaceType
  role: WorkspaceRole
}

export type Action =
  | 'resource:read'
  | 'resource:edit'
  | 'resource:delete'
  | 'resource:visibility'
  | 'pipeline:run'
  | 'destination:use'
  | 'destination:manage'
  | 'schedule:trigger'
  | 'members:manage'
  | 'workspace:delete'

type ResourceBoundary = { workspaceId: string; visibility?: Visibility }

const EDIT_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR']
const ADMIN_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN']

export class AuthorizationService {
  async contextFor(userId: string, requestedWorkspaceId?: string): Promise<AuthContext> {
    const membership = requestedWorkspaceId
      ? await db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: requestedWorkspaceId, userId } },
          include: { workspace: true },
        })
      : await db.workspaceMember.findFirst({
          where: { userId, workspace: { type: 'PERSONAL' } },
          include: { workspace: true },
          orderBy: { joinedAt: 'asc' },
        })

    if (!membership) throw Object.assign(new Error('Workspace not found'), { statusCode: 404 })
    return {
      userId,
      workspaceId: membership.workspaceId,
      workspaceType: membership.workspace.type,
      role: membership.role,
    }
  }

  authorize(context: AuthContext, action: Action, resource?: ResourceBoundary) {
    const sameWorkspace = !resource || resource.workspaceId === context.workspaceId
    if (action === 'resource:read') {
      if (sameWorkspace || resource?.visibility === 'PUBLIC') return
      throw Object.assign(new Error('Not found'), { statusCode: 404 })
    }

    if (!sameWorkspace || context.workspaceType === 'COMMUNITY') {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    }

    const allowed =
      action === 'workspace:delete' ? context.role === 'OWNER'
      : action === 'members:manage' || action === 'resource:visibility' || action === 'destination:manage'
        ? ADMIN_ROLES.includes(context.role)
        : EDIT_ROLES.includes(context.role)

    if (!allowed) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }

  assertSameWorkspace(workspaceId: string, resources: Array<{ workspaceId: string }>) {
    if (resources.some((resource) => resource.workspaceId !== workspaceId)) {
      throw Object.assign(new Error('Resources must belong to the same workspace'), { statusCode: 400 })
    }
  }
}

export const authorization = new AuthorizationService()
