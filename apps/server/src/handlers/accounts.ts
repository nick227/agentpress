import { AccountService } from '../services/AccountService'

const svc = new AccountService()

export async function listAccountNavigation(request: any, reply: any) {
  const nav = await svc.navigation(request.auth)
  return reply.send(nav)
}

export async function syncAccount(request: any, reply: any) {
  const data = await svc.sync(request.auth)
  return reply.send({ data })
}
