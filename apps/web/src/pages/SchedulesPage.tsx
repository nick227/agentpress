import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus } from 'lucide-react'
import { useSchedules } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type ScheduleSummary = components['schemas']['ScheduleSummary']

function relativeTime(iso?: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function nextRunLabel(iso?: string | null) {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.floor(hrs / 24)}d`
}

function cadenceLabel(type: string) {
  const map: Record<string, string> = {
    hourly: 'Every hour',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    cron: 'Custom cron',
  }
  return map[type] ?? type
}

function executionStatusDot(status?: string | null) {
  if (!status) return 'bg-muted-foreground/30'
  if (status === 'completed') return 'bg-green-500'
  if (status === 'failed') return 'bg-red-500'
  if (status === 'partial') return 'bg-amber-400'
  if (status === 'running' || status === 'queued') return 'bg-blue-400'
  return 'bg-muted-foreground/30'
}

export function SchedulesPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useSchedules()
  const schedules = data?.data ?? []

  const enabled = schedules.filter((s) => s.enabled)
  const paused = schedules.filter((s) => !s.enabled)

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">
            {schedules.length} schedule{schedules.length === 1 ? '' : 's'}
            {enabled.length > 0 && ` · ${enabled.length} enabled`}
          </p>
        </div>
        <div className="page-header-actions">
          <Button size="sm" onClick={() => navigate('/schedules/new')}>
            <Plus size={13} /> New schedule
          </Button>
        </div>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">
        Check research feeds and conditionally dispatch pipelines on a recurring cadence.
      </p>

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules"
          description="Create a schedule to orchestrate research checks and pipeline runs."
          action={{ label: 'New schedule', onClick: () => navigate('/schedules/new') }}
        />
      ) : (
        <div className="space-y-6">
          {enabled.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Enabled <span className="font-normal text-muted-foreground/60">{enabled.length}</span>
              </h2>
              <div className="divide-y rounded border bg-surface">
                {enabled.map((s) => <ScheduleRow key={s.id} schedule={s} onClick={() => navigate(`/schedules/${s.id}`)} />)}
              </div>
            </section>
          )}
          {paused.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paused <span className="font-normal text-muted-foreground/60">{paused.length}</span>
              </h2>
              <div className="divide-y rounded border bg-surface">
                {paused.map((s) => <ScheduleRow key={s.id} schedule={s} onClick={() => navigate(`/schedules/${s.id}`)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ScheduleRow({ schedule, onClick }: { schedule: ScheduleSummary; onClick: () => void }) {
  const lastRun = relativeTime(schedule.lastRunAt)
  const nextRun = nextRunLabel(schedule.nextRunAt)
  const dotClass = executionStatusDot(schedule.lastExecutionStatus)

  return (
    <button
      type="button"
      onClick={onClick}
      className="list-row hover:bg-muted/30 transition-colors"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0', dotClass)} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{schedule.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cadenceLabel(schedule.cadenceType)}
            {schedule.sourceCount > 0 && ` · ${schedule.sourceCount} feed${schedule.sourceCount === 1 ? '' : 's'}`}
            {schedule.pipelineCount > 0 && ` · ${schedule.pipelineCount} pipeline${schedule.pipelineCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="list-row-meta pl-5 sm:pl-0">
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          {lastRun && <span>last run {lastRun}</span>}
          {nextRun && schedule.enabled && (
            <span className={nextRun === 'overdue' ? 'text-amber-600' : ''}>{nextRun}</span>
          )}
          {!lastRun && !nextRun && <span className="text-muted-foreground/50">never run</span>}
        </div>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium',
            schedule.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {schedule.enabled ? 'Enabled' : 'Paused'}
        </span>
      </div>
    </button>
  )
}
