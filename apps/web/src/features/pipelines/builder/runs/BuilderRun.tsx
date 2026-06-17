import { usePipelineRun } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { CheckCircle2, XCircle, Loader2, Clock, FileText, FileJson, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  runId: string
}

const STATUS_MAP: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  queued: { icon: <Clock size={14} />, label: 'Queued', color: 'text-muted-foreground' },
  running: { icon: <Loader2 size={14} className="animate-spin" />, label: 'Running', color: 'text-accent' },
  completed: { icon: <CheckCircle2 size={14} />, label: 'Completed', color: 'text-green-600' },
  posted: { icon: <CheckCircle2 size={14} />, label: 'Published', color: 'text-green-600' },
  failed: { icon: <XCircle size={14} />, label: 'Failed', color: 'text-destructive' },
}

const ASSET_ICON: Record<string, React.ReactNode> = {
  text: <FileText size={13} />,
  json: <FileJson size={13} />,
  image: <Image size={13} />,
}

export function BuilderRun({ runId }: Props) {
  const { data, isLoading } = usePipelineRun(runId)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const run = data?.data
  const agentRuns = data?.agentRuns ?? []
  const assets = data?.assets ?? []
  const publishAttempts = data?.publishAttempts ?? []

  if (!run) return null

  const statusInfo = STATUS_MAP[run.status] ?? STATUS_MAP.queued!
  const post = run.generatedPost as any

  const isActive = run.status === 'queued' || run.status === 'running'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={cn('flex items-center gap-1.5 text-sm font-medium', statusInfo.color)}>
          {statusInfo.icon}
          {statusInfo.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {run.dryRun ? 'Dry run' : 'Live run'} · {new Date(run.startedAt).toLocaleString()}
        </span>
        {isActive && (
          <span className="text-xs text-muted-foreground animate-pulse">Refreshing…</span>
        )}
      </div>

      {run.error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {run.error}
        </div>
      )}

      {/* Generated post */}
      {post && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Generated Post</h2>

          {post.title && (
            <Section title="Title">
              <p className="text-base font-semibold">{post.title}</p>
            </Section>
          )}

          {post.thumbnailUrl && (
            <Section title="Thumbnail">
              <img src={post.thumbnailUrl} alt="Generated thumbnail" className="rounded max-w-sm w-full" />
            </Section>
          )}

          {post.thumbnailPrompt && !post.thumbnailUrl && (
            <Section title="Thumbnail prompt">
              <p className="text-sm text-muted-foreground">{post.thumbnailPrompt}</p>
            </Section>
          )}

          {post.excerpt && (
            <Section title="Excerpt">
              <p className="text-sm">{post.excerpt}</p>
            </Section>
          )}

          {post.body && (
            <Section title="Body">
              <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed border rounded p-4 bg-muted/20 max-h-96 overflow-y-auto font-mono">
                {post.body}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Assets */}
      {assets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Saved Assets</h2>
          <div className="flex flex-wrap gap-2">
            {assets.map((asset) => (
              <span
                key={asset.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border bg-surface"
              >
                <span className="text-muted-foreground">{ASSET_ICON[asset.type]}</span>
                {asset.filename}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Publish */}
      {publishAttempts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Publishing</h2>
          {publishAttempts.map((attempt) => (
            <div key={attempt.id} className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                {attempt.status === 'success' ? (
                  <CheckCircle2 size={14} className="text-green-600" />
                ) : attempt.status === 'failed' ? (
                  <XCircle size={14} className="text-destructive" />
                ) : (
                  <Clock size={14} className="text-muted-foreground" />
                )}
                <span className="capitalize">{attempt.status}</span>
              </div>
              {attempt.remoteUrl && (
                <a
                  href={attempt.remoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {attempt.remoteUrl}
                </a>
              )}
              {attempt.error && <p className="text-xs text-destructive">{attempt.error}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Agent details */}
      {agentRuns.length > 0 && (
        <details>
          <summary className="text-sm font-semibold cursor-pointer select-none">
            Agent Outputs ({agentRuns.length})
          </summary>
          <div className="mt-3 space-y-3">
            {agentRuns.map((ar) => {
              const info = STATUS_MAP[ar.status] ?? STATUS_MAP.queued!
              return (
                <div key={ar.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{ar.agentName} <span className="text-muted-foreground font-normal">→ {ar.outputTarget}</span></p>
                    <span className={cn('flex items-center gap-1 text-xs', info.color)}>
                      {info.icon}
                      {info.label}
                    </span>
                  </div>
                  {ar.outputText && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-40 overflow-y-auto">
                      {ar.outputText}
                    </pre>
                  )}
                  {ar.error && <p className="text-xs text-destructive">{ar.error}</p>}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}
