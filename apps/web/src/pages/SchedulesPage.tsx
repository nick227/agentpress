import { CalendarClock, ChevronLeft, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAccount, useSchedules } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export function SchedulesPage() {
  const { accountSlug } = useParams<{ accountSlug: string }>()
  const navigate = useNavigate()
  const { data: accountData, isLoading: accountLoading } = useAccount(accountSlug!)
  const account = accountData?.data
  const { data, isLoading } = useSchedules(account?.id ?? '')
  const schedules = data?.data ?? []

  if (accountLoading || isLoading) {
    return <div className="p-6 max-w-4xl mx-auto space-y-3"><Skeleton className="h-7 w-44" /><Skeleton className="h-20 w-full" /></div>
  }
  if (!account) return <div className="p-6">Account not found.</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to={`/accounts/${account.slug}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ChevronLeft size={14} />
        {account.name}
      </Link>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">Check research feeds and conditionally dispatch pipelines.</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/accounts/${account.slug}/schedules/new`)}>
          <Plus size={13} /> New schedule
        </Button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules"
          description="Create account-level orchestration for research checks and pipeline runs."
          action={{ label: 'New schedule', onClick: () => navigate(`/accounts/${account.slug}/schedules/new`) }}
        />
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <Link
              key={schedule.id}
              to={`/accounts/${account.slug}/schedules/${schedule.id}`}
              className="flex items-center justify-between rounded border bg-surface px-4 py-3 hover:bg-muted/40"
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
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
