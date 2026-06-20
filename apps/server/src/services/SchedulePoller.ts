import { db } from '@project/db'
import { ScheduleExecutor } from './ScheduleExecutor'
import { nextScheduleOccurrence } from './scheduleRecurrence'

const POLL_MS = Number(process.env.SCHEDULE_POLL_MS ?? 30_000)
const MISSED_GRACE_MS = Number(process.env.SCHEDULE_MISSED_GRACE_MS ?? 90_000)

export class SchedulePoller {
  private executor = new ScheduleExecutor()
  private timer?: NodeJS.Timeout
  private polling = false

  start() {
    if (process.env.SCHEDULES_ENABLED === 'false' || this.timer) return
    void this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_MS)
    this.timer.unref()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  private async poll() {
    if (this.polling) return
    this.polling = true
    try {
      const now = new Date()
      const recoverable = await db.scheduleExecution.findMany({
        where: { status: 'running', leaseExpiresAt: { lt: now } },
        select: { id: true },
      })
      for (const execution of recoverable) void this.executor.execute(execution.id)

      const queued = await db.scheduleExecution.findMany({
        where: { status: 'queued' },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true },
      })
      for (const execution of queued) void this.executor.execute(execution.id)

      const due = await db.schedule.findMany({
        where: { enabled: true, nextRunAt: { lte: now } },
        orderBy: { nextRunAt: 'asc' },
        take: 25,
      })
      for (const schedule of due) {
        const scheduledFor = schedule.nextRunAt!
        const nextRunAt = nextScheduleOccurrence(schedule, now)
        const missed = now.getTime() - scheduledFor.getTime() > MISSED_GRACE_MS
        const execution = await db.$transaction(async (tx) => {
          const claimed = await tx.schedule.updateMany({
            where: { id: schedule.id, enabled: true, nextRunAt: scheduledFor },
            data: { nextRunAt },
          })
          if (claimed.count === 0) return null
          return tx.scheduleExecution.create({
            data: {
              scheduleId: schedule.id,
              origin: 'timer',
              dedupeKey: `timer:${schedule.id}:${scheduledFor.toISOString()}`,
              scheduledFor,
              status: missed ? 'skipped' : 'queued',
              skipReason: missed ? 'missed_while_offline' : null,
              completedAt: missed ? now : null,
            },
          })
        }).catch(() => null)
        if (execution && !missed) void this.executor.execute(execution.id)
      }
    } catch (error) {
      console.error('Schedule poll failed', error)
    } finally {
      this.polling = false
    }
  }
}
