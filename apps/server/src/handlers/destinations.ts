import { DestinationService } from '../services/DestinationService'

const svc = new DestinationService()

export async function listDestinations(request: any, reply: any) {
  const data = await svc.list(request.params.accountId)
  return reply.send({ data })
}

export async function createDestination(request: any, reply: any) {
  const data = await svc.create(request.params.accountId, request.body)
  return reply.status(201).send({ data })
}

export async function updateDestination(request: any, reply: any) {
  const data = await svc.update(request.params.destinationId, request.body)
  return reply.send({ data })
}

export async function listDestinationWordPressCategories(request: any, reply: any) {
  const data = await svc.listWordPressCategories(request.params.destinationId)
  return reply.send({ data })
}

export async function deleteDestination(request: any, reply: any) {
  await svc.delete(request.params.destinationId)
  return reply.send({ ok: true })
}
