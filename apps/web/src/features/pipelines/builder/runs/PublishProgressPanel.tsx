import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import type { components } from '@project/sdk'
import { cn } from '@/lib/utils'

type PublishAttempt = components['schemas']['PublishAttempt']

interface Props {
  attempts: PublishAttempt[]
  isPublishing: boolean
  destinationSiteUrl?: string
}

const POST_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  publish: 'Published',
  private: 'Private',
  pending: 'Pending review',
  future: 'Scheduled',
}

export function PublishProgressPanel({ attempts, isPublishing, destinationSiteUrl }: Props) {
  if (!isPublishing && attempts.length === 0) return null

  const siteHost = destinationSiteUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const sorted = [...attempts].reverse()

  return (
    <div className="space-y-2">
      {isPublishing && attempts.every((a) => a.status !== 'pending') && (
        <AttemptRow active siteHost={siteHost} />
      )}
      {sorted.map((attempt) => (
        <AttemptRow key={attempt.id} attempt={attempt} siteHost={siteHost} active={attempt.status === 'pending'} />
      ))}
    </div>
  )
}

function AttemptRow({
  attempt,
  siteHost,
  active,
}: {
  attempt?: PublishAttempt
  siteHost?: string
  active: boolean
}) {
  const status = attempt?.status
  const postStatusLabel = attempt?.postStatus ? (POST_STATUS_LABEL[attempt.postStatus] ?? attempt.postStatus) : undefined
  const isSuccess = status === 'success'
  const isFailed = status === 'failed'
  const ts = attempt?.createdAt ? new Date(attempt.createdAt).toLocaleString() : undefined

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3',
      active ? 'border-sky-200 bg-sky-50/80'
        : isFailed ? 'border-destructive/30 bg-destructive/5'
        : isSuccess ? 'border-green-200 bg-green-50/50'
        : 'border-border bg-muted/20',
    )}>
      <div className="flex items-start gap-2">
        {active ? (
          <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin text-sky-700" />
        ) : isSuccess ? (
          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-600" />
        ) : isFailed ? (
          <XCircle size={16} className="shrink-0 mt-0.5 text-destructive" />
        ) : (
          <Clock size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">
              {active ? 'Publishing to WordPress…'
                : isSuccess ? 'Published'
                : isFailed ? 'Publish failed'
                : 'Publishing…'}
            </p>
            {postStatusLabel && (
              <span className={cn(
                'text-[11px] font-medium px-1.5 py-0.5 rounded border',
                isSuccess
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-muted text-muted-foreground border-border',
              )}>
                {postStatusLabel}
              </span>
            )}
          </div>

          {siteHost && (
            <p className="text-xs text-muted-foreground">{siteHost}</p>
          )}

          {(attempt?.progressMessage || active) && (
            <p className="text-xs text-foreground/80">
              {attempt?.progressMessage ?? 'Starting…'}
            </p>
          )}

          {attempt?.remoteUrl && isSuccess && (
            <a
              href={attempt.remoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-accent hover:underline truncate max-w-full"
            >
              {attempt.remoteUrl}
            </a>
          )}

          {attempt?.error && isFailed && (
            <p className="text-xs text-destructive whitespace-pre-wrap">{attempt.error}</p>
          )}

          {ts && !active && (
            <p className="text-[11px] text-muted-foreground/60">{ts}</p>
          )}
        </div>
      </div>
    </div>
  )
}
