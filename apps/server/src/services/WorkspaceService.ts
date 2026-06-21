import { db } from '@project/db'
import { authorization, type AuthContext } from './AuthorizationService'
import { audit } from './AuditService'

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'
}

export class WorkspaceService {
  async list(userId: string) {
    const memberships = await db.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    })
    return memberships.map(({ workspace, role }) => ({ ...workspace, role }))
  }

  async createTeam(userId: string, name: string) {
    let slug = slugify(name)
    let suffix = 1
    while (await db.workspace.findUnique({ where: { slug } })) slug = `${slugify(name)}-${suffix++}`
    const workspace = await db.workspace.create({
      data: {
        name,
        slug,
        type: 'TEAM',
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { members: true },
    })
    await audit.record({ workspaceId: workspace.id, actorUserId: userId, action: 'workspace.created', targetType: 'workspace', targetId: workspace.id })
    return workspace
  }

  async listMembers(context: AuthContext) {
    return db.workspaceMember.findMany({
      where: { workspaceId: context.workspaceId },
      include: { user: { select: { id: true, email: true, createdAt: true } } },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async addMember(context: AuthContext, email: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
    authorization.authorize(context, 'members:manage')
    const user = await db.user.findUnique({ where: { email } })
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
    const membership = await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: user.id } },
      update: { role },
      create: { workspaceId: context.workspaceId, userId: user.id, role },
    })
    await audit.record({ workspaceId: context.workspaceId, actorUserId: context.userId, action: 'member.added', targetType: 'user', targetId: user.id, metadata: { role } })
    return membership
  }

  async updateMember(context: AuthContext, userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
    authorization.authorize(context, 'members:manage')
    const target = await db.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } },
    })
    if (target.role === 'OWNER') throw Object.assign(new Error('The workspace owner cannot be changed here'), { statusCode: 409 })
    const membership = await db.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } },
      data: { role },
    })
    await audit.record({ workspaceId: context.workspaceId, actorUserId: context.userId, action: 'member.role_changed', targetType: 'user', targetId: userId, metadata: { role } })
    return membership
  }

  async removeMember(context: AuthContext, userId: string) {
    authorization.authorize(context, 'members:manage')
    const target = await db.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } },
    })
    if (target.role === 'OWNER') throw Object.assign(new Error('The workspace owner cannot be removed'), { statusCode: 409 })
    await db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } } })
    await audit.record({ workspaceId: context.workspaceId, actorUserId: context.userId, action: 'member.removed', targetType: 'user', targetId: userId })
  }
}
