import { ContentService } from '../services/ContentService'

const svc = new ContentService()

export async function listContentTemplates(_request: any, reply: any) {
  return reply.send({ data: svc.listTemplates() })
}

export async function listVariablePacks(_request: any, reply: any) {
  return reply.send({ data: svc.listVariablePacks() })
}

export async function applyContentTemplate(request: any, reply: any) {
  const { name } = request.body
  const pipeline = await svc.applyTemplate(request.params.templateId, name)
  return reply.status(201).send({ data: pipeline })
}
