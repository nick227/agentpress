import { AccountService } from '../services/AccountService'

const svc = new AccountService()

export async function listAccountNavigation(_request: any, reply: any) {
  const nav = await svc.navigation()
  return reply.send(nav)
}

export async function syncAccount(_request: any, reply: any) {
  const data = await svc.sync()
  return reply.send({ data })
}
