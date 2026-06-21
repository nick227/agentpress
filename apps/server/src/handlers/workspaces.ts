import { WorkspaceService } from '../services/WorkspaceService'

const service = new WorkspaceService()

export async function listWorkspaces(request: any, reply: any) {
  return reply.send({ data: await service.list(request.user.id) })
}

export async function createTeamWorkspace(request: any, reply: any) {
  return reply.status(201).send({ data: await service.createTeam(request.user.id, request.body.name) })
}

export async function listWorkspaceMembers(request: any, reply: any) {
  return reply.send({ data: await service.listMembers(request.auth) })
}

export async function addWorkspaceMember(request: any, reply: any) {
  return reply.status(201).send({ data: await service.addMember(request.auth, request.body.email, request.body.role) })
}

export async function updateWorkspaceMember(request: any, reply: any) {
  return reply.send({ data: await service.updateMember(request.auth, request.params.userId, request.body.role) })
}

export async function removeWorkspaceMember(request: any, reply: any) {
  await service.removeMember(request.auth, request.params.userId)
  return reply.send({ ok: true })
}
