import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, CheckCircle2, Clock, FileText, ImageOff, Layers, Loader2, Play, RefreshCw, Zap, XCircle } from 'lucide-react'
import { useAllRuns, usePipelineRun, useStartPipelineRun } from '@project/sdk'
import type { components } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type RunSummary = components['schemas']['RunSummary']
type RunStatus = RunSummary['status']

const STATUS_CONFIG: Record<RunStatus, { icon: React.ReactNode; label: string; textColor: string; dot: string }> = {
  queued:    { icon: <Clock size={11} />,                           label: 'Queued',    textColor: 'text-muted-foreground',  dot: 'bg-muted-foreground/40' },
  running:   { icon: <Loader2 size={11} className="animate-spin" />, label: 'Running',   textColor: 'text-blue-500',          dot: 'bg-blue-400 animate-pulse' },
  completed: { icon: <CheckCircle2 size={11} />,                    label: 'Completed', textColor: 'text-green-600',         dot: 'bg-green-500' },
  posted:    { icon: <CheckCircle2 size={11} />,                    label: 'Published', textColor: 'text-green-600',         dot: 'bg-green-500' },
  failed:    { icon: <XCircle size={11} />,                         label: 'Failed',    textColor: 'text-destructive',       dot: 'bg-red-500' },
}

const FILTERS = ['all', 'running', 'completed', 'failed'] as const
type Filter = typeof FILTERS[number]

function matchesFilter(run: RunSummary, filter: Filter) {
  if (filter === 'all') return true
  if (filter === 'running') return run.status === 'running' || run.status === 'queued'
  if (filter === 'completed') return run.status === 'completed' || run.status === 'posted'
  return run.status === filter
}

function durationMs(run: RunSummary) {
  if (!run.completedAt) return null
  return new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function variableEntries(variables: Record<string, unknown>) {
  return Object.entries(variables).filter(([, v]) => v !== '' && v !== null && v !== undefined)
}

export function RunsPage() {
  const navigate = useNavigate()
  const { data, isLoading, refetch, isFetching } = useAllRuns(100)
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const allRuns = data?.data ?? []
  const runs = allRuns.filter((r) => matchesFilter(r, filter))

  const counts: Record<Filter, number> = {
    all: allRuns.length,
    running: allRuns.filter((r) => r.status === 'running' || r.status === 'queued').length,
    completed: allRuns.filter((r) => r.status === 'completed' || r.status === 'posted').length,
    failed: allRuns.filter((r) => r.status === 'failed').length,
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-px mt-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-lg font-semibold">Runs</h1>
          <p className="text-sm text-muted-foreground">
            {allRuns.length} run{allRuns.length === 1 ? '' : 's'} · newest first
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          title="Refresh"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mt-4 mb-5 flex gap-0 border-b">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors',
              filter === f
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
            {counts[f] > 0 && (
              <span className="ml-1.5 tabular-nums text-muted-foreground/60">{counts[f]}</span>
            )}
          </button>
        ))}
      </div>

      {allRuns.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No runs yet"
          description="Start a pipeline run from the builder to see results here."
          action={{ label: 'Go to Pipelines', onClick: () => navigate('/') }}
        />
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {filter} runs.</p>
      ) : (
        <div className="divide-y rounded border bg-surface">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              expanded={expandedId === run.id}
              onToggle={() => toggleExpand(run.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Run Row ─────────────────────────────────────────────────────────────────

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: RunSummary
  expanded: boolean
  onToggle: () => void
}) {
  const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.failed
  const ms = durationMs(run)
  const vars = variableEntries(run.variables)
  const isActive = run.status === 'running' || run.status === 'queued'

  return (
    <div className={cn('transition-colors', expanded && 'bg-muted/20')}>
      {/* Summary row — click to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Status dot */}
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', cfg.dot)} />

        {/* Main info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              onClick={(e) => e.stopPropagation()}
              className="inline-block"
            >
              <Link
                to={`/pipelines/${run.pipelineSlug}`}
                className="text-sm font-semibold text-foreground hover:underline"
              >
                {run.pipelineName}
              </Link>
            </span>
            {run.title && run.title !== run.pipelineName && (
              <span className="text-sm text-muted-foreground">— {run.title}</span>
            )}
            {run.dryRun && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                dry
              </span>
            )}
            {run.status === 'posted' && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                published
              </span>
            )}
          </div>

          {/* Meta chips row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {run.postTitle && (
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                <FileText size={10} />
                {run.postTitle}
              </span>
            )}
            {run.agentCount > 0 && (
              <span className="flex items-center gap-1">
                <Bot size={10} />
                {run.agentCount} agent{run.agentCount === 1 ? '' : 's'}
              </span>
            )}
            {run.assetCount > 0 && (
              <span className="flex items-center gap-1">
                <Layers size={10} />
                {run.assetCount} asset{run.assetCount === 1 ? '' : 's'}
              </span>
            )}
            {vars.length > 0 && (
              <span className="flex items-center gap-1">
                {vars.map(([k]) => (
                  <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {k}
                  </span>
                ))}
              </span>
            )}
          </div>

          {/* Error inline */}
          {run.error && !expanded && (
            <p className="text-xs text-destructive truncate max-w-md">{run.error}</p>
          )}
        </div>

        {/* Right column: time + status */}
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="tabular-nums text-muted-foreground">{relativeTime(run.startedAt)}</span>
          <span className={cn('flex items-center gap-1 font-medium', cfg.textColor)}>
            {cfg.icon}
            {cfg.label}
            {ms !== null && !isActive && (
              <span className="font-normal text-muted-foreground/60 ml-1">{formatDuration(ms)}</span>
            )}
          </span>
        </div>
      </button>

      {/* Expanded detail + controls */}
      {expanded && <RunDetail run={run} />}
    </div>
  )
}

// ─── Expanded detail ─────────────────────────────────────────────────────────

function RunDetail({ run }: { run: RunSummary }) {
  const [dryRun, setDryRun] = useState(run.dryRun)
  const startRun = useStartPipelineRun()
  const ms = durationMs(run)

  async function handleRerun() {
    try {
      await startRun.mutateAsync({
        pipelineId: run.pipelineId,
        variables: run.variables,
        dryRun,
        title: run.title ?? run.pipelineName,
      })
      toast.success(dryRun ? 'Dry run started' : 'Live run started')
    } catch {
      toast.error('Failed to start run')
    }
  }

  return (
    <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-4">
      {/* Timing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <MetaField label="Started" value={new Date(run.startedAt).toLocaleString()} />
        {run.completedAt && (
          <MetaField label="Completed" value={new Date(run.completedAt).toLocaleString()} />
        )}
        {ms !== null && <MetaField label="Duration" value={formatDuration(ms)} />}
        {run.destinationId && <MetaField label="Destination" value={run.destinationId} />}
      </div>

      {/* Error */}
      {run.error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <p className="font-medium mb-0.5">Error</p>
          <p className="font-mono whitespace-pre-wrap break-all">{run.error}</p>
        </div>
      )}

      {/* Generated post — lazy loaded when expanded */}
      {run.hasPost && <RunPostPreview runId={run.id} />}

      {/* Re-run */}
      <div className="border-t pt-3 flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run
        </label>
        <Button
          size="sm"
          onClick={handleRerun}
          loading={startRun.isPending}
          disabled={startRun.isPending}
        >
          <Zap size={12} />
          Run live
        </Button>
      </div>
    </div>
  )
}

// ─── Lazy post preview (only mounted when run is expanded + hasPost) ──────────

type GeneratedPost = {
  title?: string
  excerpt?: string
  thumbnailStatus?: 'generating' | 'done' | 'failed'
  thumbnailUrl?: string
  body?: string
}

function RunPostPreview({ runId }: { runId: string }) {
  const { data, isLoading } = usePipelineRun(runId)
  const post = data?.data?.generatedPost as GeneratedPost | null | undefined

  if (isLoading) {
    return (
      <div className="space-y-2 rounded border bg-surface p-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-36 w-full rounded" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    )
  }

  if (!post) return null

  const showThumbnail = post.thumbnailStatus !== undefined || post.thumbnailUrl
  const thumbGenerating = post.thumbnailStatus === 'generating'
  const thumbFailed = post.thumbnailStatus === 'failed'

  return (
    <div className="rounded border bg-surface overflow-hidden">
      {/* Thumbnail */}
      {showThumbnail && (
        <div className="relative w-full bg-muted" style={{ aspectRatio: '16/7' }}>
          {thumbGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Generating thumbnail…</span>
            </div>
          ) : thumbFailed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <ImageOff size={20} />
              <span>Thumbnail failed</span>
            </div>
          ) : post.thumbnailUrl ? (
            <img
              src={post.thumbnailUrl}
              alt="Post thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
      )}

      <div className="px-3 py-3 space-y-2">
        {/* Title */}
        {post.title && (
          <p className="text-sm font-semibold text-foreground leading-snug">{post.title}</p>
        )}

        {/* Body */}
        {post.body && (
          <div className="max-h-48 overflow-y-auto rounded bg-muted/40 px-2 py-2">
            <p className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
              {post.body}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground/80 tabular-nums">{value}</p>
    </div>
  )
}
