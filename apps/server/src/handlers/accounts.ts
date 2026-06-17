import { AccountService } from '../services/AccountService'

const svc = new AccountService()

export async function listAccounts(_request: any, reply: any) {
  const data = await svc.list()
  return reply.send({ data })
}

export async function getAccount(request: any, reply: any) {
  const data = await svc.get(request.params.accountId)
  if (!data) return reply.status(404).send({ error: 'Account not found' })
  return reply.send({ data })
}

export async function createAccount(request: any, reply: any) {
  const data = await svc.create(request.body)
  return reply.status(201).send({ data })
}

export async function updateAccount(request: any, reply: any) {
  const data = await svc.update(request.params.accountId, request.body)
  return reply.send({ data })
}

export async function deleteAccount(request: any, reply: any) {
  await svc.delete(request.params.accountId)
  return reply.send({ ok: true })
}
