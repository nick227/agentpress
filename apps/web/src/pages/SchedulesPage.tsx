import { CalendarClock, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSchedules } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export function SchedulesPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useSchedules()
  const schedules = data?.data ?? []

  if (isLoading) {
    return <div className="p-6 max-w-4xl mx-auto space-y-3"><Skeleton className="h-7 w-44" /><Skeleton className="h-20 w-full" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">Check research feeds and conditionally dispatch pipelines.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/schedules/new')}>
          <Plus size={13} /> New schedule
        </Button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules"
          description="Create a schedule to orchestrate research checks and pipeline runs."
          action={{ label: 'New schedule', onClick: () => navigate('/schedules/new') }}
        />
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              onClick={() => navigate(`/schedules/${schedule.id}`)}
              className="flex w-full items-center justify-between rounded border bg-surface px-4 py-3 hover:bg-muted/40 text-left"
            >
              <div>
                <p className="text-sm font-medium">{schedule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {schedule.sourceCount} feed{schedule.sourceCount === 1 ? '' : 's'} · {schedule.pipelineCount} pipeline{schedule.pipelineCount === 1 ? '' : 's'} · {schedule.cadenceType}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs rounded px-2 py-0.5 ${schedule.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {schedule.enabled ? 'Enabled' : 'Paused'}
                </span>
                {schedule.nextRunAt && <p className="text-xs text-muted-foreground mt-1">Next {new Date(schedule.nextRunAt).toLocaleString()}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
