import { Link } from 'react-router-dom'
import { ArrowRight, Bot, CheckCircle2, Clock, FileText, Layers, Loader2, Play, RefreshCw, Send, Workflow, XCircle, Zap } from 'lucide-react'
import { useAllRuns, usePipelines } from '@project/sdk'
import type { components } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type RunSummary = components['schemas']['RunSummary']
type RunStatus = RunSummary['status']
type PipelineSummary = components['schemas']['PipelineSummary']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isYesterday(iso: string) {
  const d = new Date(iso)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
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

function durationMs(run: RunSummary) {
  if (!run.completedAt) return null
  return new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function groupByDate(runs: RunSummary[]): Array<{ label: string; runs: RunSummary[] }> {
  const groups: Record<string, RunSummary[]> = {}
  for (const run of runs) {
    let label: string
    if (isToday(run.startedAt)) label = 'Today'
    else if (isYesterday(run.startedAt)) label = 'Yesterday'
    else {
      const d = new Date(run.startedAt)
      label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    }
    ;(groups[label] ??= []).push(run)
  }
  return Object.entries(groups).map(([label, runs]) => ({ label, runs }))
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RunStatus, { icon: React.ReactNode; label: string; textColor: string; dot: string }> = {
  queued:    { icon: <Clock size={10} />,                             label: 'Queued',    textColor: 'text-muted-foreground',  dot: 'bg-muted-foreground/50' },
  running:   { icon: <Loader2 size={10} className="animate-spin" />,  label: 'Running',   textColor: 'text-blue-500',          dot: 'bg-blue-400 animate-pulse' },
  completed: { icon: <CheckCircle2 size={10} />,                      label: 'Completed', textColor: 'text-green-600',         dot: 'bg-green-500' },
  posted:    { icon: <CheckCircle2 size={10} />,                      label: 'Published', textColor: 'text-green-600',         dot: 'bg-green-500' },
  failed:    { icon: <XCircle size={10} />,                           label: 'Failed',    textColor: 'text-destructive',       dot: 'bg-red-500' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const { data: runsData, isLoading: runsLoading, refetch, isFetching } = useAllRuns(100)
  const { data: pipelinesData, isLoading: pipelinesLoading } = usePipelines()

  const runs = runsData?.data ?? []
  const pipelines: PipelineSummary[] = (pipelinesData as any)?.data ?? []

  const stats = {
    active:         runs.filter((r) => r.status === 'running' || r.status === 'queued').length,
    completedToday: runs.filter((r) => (r.status === 'completed' || r.status === 'posted') && isToday(r.startedAt)).length,
    publishedToday: runs.filter((r) => r.status === 'posted' && isToday(r.startedAt)).length,
    failed:         runs.filter((r) => r.status === 'failed').length,
    total:          runs.length,
  }

  // Latest run per pipeline (for health column)
  const latestRunByPipeline = new Map<string, RunSummary>()
  for (const run of runs) {
    if (run.pipelineId && !latestRunByPipeline.has(run.pipelineId)) {
      latestRunByPipeline.set(run.pipelineId, run)
    }
  }

  const groups = groupByDate(runs)

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Activity across all pipelines</p>
        </div>
        <div className="page-header-actions">
          <Link
            to="/runs"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-input-border bg-surface px-3 text-xs font-medium hover:bg-muted"
          >
            All runs <ArrowRight size={12} />
          </Link>
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
      </div>

      {/* Stats strip */}
      {runsLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard value={stats.active} label="Active now" color={stats.active > 0 ? 'blue' : 'neutral'} pulse={stats.active > 0} />
          <StatCard value={stats.completedToday} label="Completed today" color="green" />
          <StatCard value={stats.publishedToday} label="Published today" color={stats.publishedToday > 0 ? 'teal' : 'neutral'} />
          <StatCard value={stats.failed} label="Failed" color={stats.failed > 0 ? 'red' : 'neutral'} />
          <StatCard value={stats.total} label="Total runs" color="neutral" />
        </div>
      )}

      {/* Main two-column layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Activity feed */}
        <div className="min-w-0 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>

          {runsLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded border border-dashed py-12 text-center text-sm text-muted-foreground">
              <Play size={20} className="opacity-40" />
              <p>No runs yet. Start a pipeline to see activity here.</p>
              <Link to="/pipelines" className="text-foreground underline underline-offset-2 hover:opacity-70">
                Go to pipelines
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(({ label, runs: groupRuns }) => (
                <div key={label}>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
                  <div className="divide-y rounded border bg-surface">
                    {groupRuns.map((run) => <RunRow key={run.id} run={run} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline health sidebar */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline health</h2>

          {pipelinesLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
            </div>
          ) : pipelines.length === 0 ? (
            <div className="rounded border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              No pipelines yet.{' '}
              <Link to="/pipelines/new" className="text-foreground underline underline-offset-2">Create one</Link>
            </div>
          ) : (
            <div className="divide-y rounded border bg-surface">
              {pipelines.map((pipeline) => (
                <PipelineHealthRow
                  key={pipeline.id}
                  pipeline={pipeline}
                  latestRun={latestRunByPipeline.get(pipeline.id)}
                  runsToday={runs.filter((r) => r.pipelineId === pipeline.id && isToday(r.startedAt)).length}
                />
              ))}
            </div>
          )}

          <Link
            to="/pipelines"
            className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Manage pipelines <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

type StatColor = 'blue' | 'green' | 'teal' | 'red' | 'neutral'

const STAT_COLOR: Record<StatColor, { value: string; label: string; ring: string }> = {
  blue:    { value: 'text-blue-500',          label: 'text-blue-500/70',          ring: 'border-blue-200 dark:border-blue-900/60' },
  green:   { value: 'text-green-600',         label: 'text-green-600/70',         ring: 'border-green-200 dark:border-green-900/60' },
  teal:    { value: 'text-teal-600',          label: 'text-teal-600/70',          ring: 'border-teal-200 dark:border-teal-900/60' },
  red:     { value: 'text-destructive',       label: 'text-destructive/70',       ring: 'border-red-200 dark:border-red-900/60' },
  neutral: { value: 'text-foreground',        label: 'text-muted-foreground',     ring: 'border-input-border' },
}

function StatCard({ value, label, color, pulse }: { value: number; label: string; color: StatColor; pulse?: boolean }) {
  const c = STAT_COLOR[color]
  return (
    <div className={cn('flex flex-col gap-1 rounded border bg-surface px-4 py-3', c.ring)}>
      <div className="flex items-center gap-1.5">
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
        <span className={cn('text-2xl font-semibold tabular-nums leading-none', c.value)}>{value}</span>
      </div>
      <span className={cn('text-[11px] font-medium', c.label)}>{label}</span>
    </div>
  )
}

// ─── Run row ─────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: RunSummary }) {
  const cfg = STATUS_CFG[run.status] ?? STATUS_CFG.failed
  const ms = durationMs(run)
  const isActive = run.status === 'running' || run.status === 'queued'

  const displayName = run.title && run.title !== run.pipelineName
    ? run.title
    : (run.pipelineName ?? run.workflowName ?? 'Run')

  return (
    <Link
      to={`/runs/${run.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      {/* Status dot */}
      <span className={cn('mt-[5px] h-2 w-2 shrink-0 rounded-full', cfg.dot)} />

      {/* Main info */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground truncate">{displayName}</span>

          {run.pipelineSlug && run.title && run.title !== run.pipelineName && (
            <span
              onClick={(e) => e.preventDefault()}
              className="inline-block"
            >
              <Link
                to={`/pipelines/${run.pipelineSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Workflow size={9} />
                {run.pipelineName}
              </Link>
            </span>
          )}

          {run.dryRun && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">dry</span>
          )}
          {run.status === 'posted' && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Send size={8} className="inline mr-0.5" />published
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {run.postTitle && (
            <span className="flex items-center gap-1 text-foreground/70">
              <FileText size={9} />
              <span className="truncate max-w-[200px]">{run.postTitle}</span>
            </span>
          )}
          {run.agentCount > 0 && (
            <span className="flex items-center gap-1">
              <Bot size={9} />
              {run.agentCount}
            </span>
          )}
          {run.assetCount > 0 && (
            <span className="flex items-center gap-1">
              <Layers size={9} />
              {run.assetCount}
            </span>
          )}
          {run.error && (
            <span className="text-destructive truncate max-w-[220px]">{run.error}</span>
          )}
        </div>
      </div>

      {/* Right: time + status */}
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
        <span className="tabular-nums text-muted-foreground">{relativeTime(run.startedAt)}</span>
        <span className={cn('flex items-center gap-1 font-medium', cfg.textColor)}>
          {cfg.icon}
          {cfg.label}
          {ms !== null && !isActive && (
            <span className="font-normal text-muted-foreground/60">{formatDuration(ms)}</span>
          )}
        </span>
      </div>
    </Link>
  )
}

// ─── Pipeline health row ──────────────────────────────────────────────────────

function PipelineHealthRow({
  pipeline,
  latestRun,
  runsToday,
}: {
  pipeline: PipelineSummary
  latestRun: RunSummary | undefined
  runsToday: number
}) {
  const cfg = latestRun ? (STATUS_CFG[latestRun.status] ?? STATUS_CFG.failed) : null
  const noRuns = !latestRun

  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      {/* Status dot */}
      {cfg ? (
        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
      ) : (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/20" />
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          to={`/pipelines/${pipeline.slug}`}
          className="block truncate text-xs font-medium text-foreground hover:underline"
        >
          {pipeline.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          {noRuns ? (
            <span>No runs yet</span>
          ) : latestRun ? (
            <>
              <span className={cn(cfg?.textColor)}>{cfg?.label}</span>
              <span>·</span>
              <span>{relativeTime(latestRun.startedAt)}</span>
              {runsToday > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Zap size={8} />
                    {runsToday} today
                  </span>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Quick action: link to pipeline */}
      <Link
        to={`/pipelines/${pipeline.slug}`}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Open pipeline"
      >
        <ArrowRight size={11} />
      </Link>
    </div>
  )
}
