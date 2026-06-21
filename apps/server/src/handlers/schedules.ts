import { ScheduleExecutor } from '../services/ScheduleExecutor'
import { ScheduleService } from '../services/ScheduleService'
import { authorization } from '../services/AuthorizationService'
import { audit } from '../services/AuditService'

const schedules = new ScheduleService()
const executor = new ScheduleExecutor()

export async function listSchedules(request: any, reply: any) {
  return reply.send({ data: await schedules.list(request.auth) })
}

export async function getSchedule(request: any, reply: any) {
  const data = await schedules.get(request.auth, request.params.scheduleId)
  if (!data) return reply.status(404).send({ error: 'Schedule not found' })
  return reply.send({ data })
}

export async function createSchedule(request: any, reply: any) {
  const data = await schedules.create(request.auth, request.body)
  return reply.status(201).send({ data })
}

export async function updateSchedule(request: any, reply: any) {
  const data = await schedules.update(request.auth, request.params.scheduleId, request.body)
  return reply.send({ data })
}

export async function deleteSchedule(request: any, reply: any) {
  await schedules.delete(request.auth, request.params.scheduleId)
  return reply.send({ ok: true })
}

export async function runSchedule(request: any, reply: any) {
  authorization.authorize(request.auth, 'schedule:trigger')
  const schedule = await schedules.get(request.auth, request.params.scheduleId)
  if (!schedule) return reply.status(404).send({ error: 'Schedule not found' })
  const data = await executor.enqueue(schedule.id, 'manual')
  await audit.record({ workspaceId: request.auth.workspaceId, actorUserId: request.auth.userId, action: 'schedule.triggered', targetType: 'schedule', targetId: schedule.id, metadata: { executionId: data.id } })
  return reply.status(202).send({ data: { id: data.id, status: data.status } })
}

export async function listScheduleExecutions(request: any, reply: any) {
  return reply.send({
    data: await schedules.listExecutions(request.auth, request.params.scheduleId, Number(request.query?.limit ?? 25)),
  })
}

export async function getScheduleExecution(request: any, reply: any) {
  const data = await schedules.getExecution(request.auth, request.params.executionId)
  if (!data) return reply.status(404).send({ error: 'Schedule execution not found' })
  return reply.send({ data })
}
