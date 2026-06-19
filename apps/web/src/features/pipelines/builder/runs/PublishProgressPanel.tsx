import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import type { components } from '@project/sdk'
import { cn } from '@/lib/utils'

type PublishAttempt = components['schemas']['PublishAttempt']

interface Props {
  attempts: PublishAttempt[]
  isPublishing: boolean
  destinationSiteUrl?: string
}

export function PublishProgressPanel({ attempts, isPublishing, destinationSiteUrl }: Props) {
  const latest = attempts[attempts.length - 1]
  if (!latest && !isPublishing) return null

  const active = isPublishing || latest?.status === 'pending'
  const siteHost = destinationSiteUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 space-y-2',
      active ? 'border-sky-200 bg-sky-50/80' : latest?.status === 'failed'
        ? 'border-destructive/30 bg-destructive/5'
        : 'border-green-200 bg-green-50/50',
    )}>
      <div className="flex items-start gap-2">
        {active ? (
          <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin text-sky-700" />
        ) : latest?.status === 'success' ? (
          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-600" />
        ) : latest?.status === 'failed' ? (
          <XCircle size={16} className="shrink-0 mt-0.5 text-destructive" />
        ) : (
          <Clock size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {active ? 'Publishing to WordPress…' : latest?.status === 'success' ? 'Published' : latest?.status === 'failed' ? 'Publish failed' : 'Publishing'}
          </p>
          {siteHost && (
            <p className="text-xs text-muted-foreground">{siteHost}</p>
          )}
          {(latest?.progressMessage || active) && (
            <p className="text-xs text-foreground/80">
              {latest?.progressMessage ?? 'Starting…'}
            </p>
          )}
          {latest?.remoteUrl && latest.status === 'success' && (
            <a
              href={latest.remoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-accent hover:underline truncate max-w-full"
            >
              {latest.remoteUrl}
            </a>
          )}
          {latest?.error && latest.status === 'failed' && (
            <p className="text-xs text-destructive whitespace-pre-wrap">{latest.error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
