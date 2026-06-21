import { DestinationService } from '../services/DestinationService'

const svc = new DestinationService()

export async function listDestinations(request: any, reply: any) {
  const data = await svc.list(request.auth)
  return reply.send({ data })
}

export async function getDestination(request: any, reply: any) {
  const data = await svc.get(request.auth, request.params.destinationId)
  if (!data) return reply.status(404).send({ error: 'Destination not found' })
  return reply.send({ data })
}

export async function createDestination(request: any, reply: any) {
  const data = await svc.create(request.auth, request.body)
  return reply.status(201).send({ data })
}

export async function updateDestination(request: any, reply: any) {
  const data = await svc.update(request.auth, request.params.destinationId, request.body)
  return reply.send({ data })
}

export async function listDestinationWordPressCategories(request: any, reply: any) {
  const data = await svc.listWordPressCategories(request.auth, request.params.destinationId)
  return reply.send({ data })
}

export async function deleteDestination(request: any, reply: any) {
  await svc.delete(request.auth, request.params.destinationId)
  return reply.send({ ok: true })
}
