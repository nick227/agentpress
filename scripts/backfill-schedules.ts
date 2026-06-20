import { db } from '../packages/db/src/client'
import { nextScheduleOccurrence } from '../apps/server/src/services/scheduleRecurrence'

async function uniqueScheduleName(accountId: string, base: string) {
  let name = base
  let suffix = 1
  while (await db.schedule.findUnique({ where: { accountId_name: { accountId, name } } })) {
    suffix++
    name = `${base} ${suffix}`
  }
  return name
}

async function main() {
  const pipelines = await db.pipeline.findMany({
    where: { scheduleMode: 'recurring' },
    include: { variables: true, agents: { where: { enabled: true } } },
  })
  let created = 0
  for (const pipeline of pipelines) {
    const existing = await db.schedulePipelineAction.findFirst({
      where: { pipelineId: pipeline.id },
      include: { schedule: true },
    })
    if (existing?.schedule.name.startsWith(`${pipeline.name} schedule`)) continue

    const cadenceType = ['daily', 'weekly', 'monthly'].includes(pipeline.frequency ?? '')
      ? pipeline.frequency!
      : 'daily'
    const timezone = pipeline.timezone || 'UTC'
    const timeOfDay = pipeline.timeOfDay || '09:00'
    const missingRequired = pipeline.variables.some((variable) => variable.required && !variable.defaultValue)
    const enabled = pipeline.status === 'active' && !pipeline.isPaused && pipeline.agents.length > 0 && !missingRequired
    const recurrence = {
      cadenceType,
      timezone,
      timeOfDay,
      dayOfWeek: cadenceType === 'weekly' ? 1 : null,
      dayOfMonth: cadenceType === 'monthly' ? 1 : null,
    }
    await db.schedule.create({
      data: {
        accountId: pipeline.accountId,
        name: await uniqueScheduleName(pipeline.accountId, `${pipeline.name} schedule`),
        enabled,
        ...recurrence,
        nextRunAt: enabled ? nextScheduleOccurrence(recurrence) : null,
        pipelineActions: {
          create: {
            pipelineId: pipeline.id,
            triggerPolicy: 'always',
            variableOverrides: {},
          },
        },
      },
    })
    created++
  }
  console.log(`Created ${created} account schedule${created === 1 ? '' : 's'} from legacy pipeline timers.`)
}

main().finally(() => db.$disconnect())
