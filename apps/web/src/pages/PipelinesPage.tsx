import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import { usePipelines, useDeletePipeline } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { CreatePipelineDialog } from '@/features/pipelines/CreatePipelineDialog'
import { PipelineStatusBadge } from '@/features/pipelines/PipelineStatusBadge'
import { TemplateBrowser } from '@/features/content/TemplateBrowser'
import { cn } from '@/lib/utils'

type PipelineSummary = components['schemas']['PipelineSummary']

function relativeTime(iso?: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const STATUS_GROUPS = ['active', 'draft', 'paused', 'archived'] as const

export function PipelinesPage() {
  const navigate = useNavigate()
  const { data, isLoading } = usePipelines()
  const deletePipeline = useDeletePipeline()
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const all = data?.data ?? []
  const filtered = all.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  // Group by status in the preferred order; skip empty groups
  const grouped = STATUS_GROUPS
    .map((status) => ({ status, items: filtered.filter((p) => p.status === status) }))
    .filter((g) => g.items.length > 0)

  // Ungrouped when searching — just flat
  const showGrouped = !search

  const totalActive = all.filter((p) => p.status === 'active').length

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Pipelines</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} pipeline{all.length === 1 ? '' : 's'}
            {totalActive > 0 && ` · ${totalActive} active`}
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="outline" size="sm" onClick={() => setShowTemplateBrowser(true)}>
            From Template
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Pipeline
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pipelines…"
          className="max-w-xs"
        />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No pipelines yet"
          description="Create your first pipeline to start building AI workflows."
          action={{ label: 'New Pipeline', onClick: () => setShowCreate(true) }}
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pipelines match your search.</p>
      ) : showGrouped ? (
        <div className="space-y-6">
          {grouped.map(({ status, items }) => (
            <div key={status}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                {status} <span className="font-normal text-muted-foreground/60">{items.length}</span>
              </h2>
              <div className="divide-y rounded border bg-surface">
                {items.map((p) => (
                  <PipelineRow
                    key={p.id}
                    pipeline={p}
                    isConfirming={confirmDeleteId === p.id}
                    isDeleting={deletePipeline.isPending && confirmDeleteId === p.id}
                    onClick={() => navigate(`/pipelines/${p.slug}`)}
                    onDelete={async () => { await deletePipeline.mutateAsync(p.id); setConfirmDeleteId(null) }}
                    onConfirmDelete={() => setConfirmDeleteId(p.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y rounded border bg-surface">
          {filtered.map((p) => (
            <PipelineRow
              key={p.id}
              pipeline={p}
              isConfirming={confirmDeleteId === p.id}
              isDeleting={deletePipeline.isPending && confirmDeleteId === p.id}
              onClick={() => navigate(`/pipelines/${p.slug}`)}
              onDelete={async () => { await deletePipeline.mutateAsync(p.id); setConfirmDeleteId(null) }}
              onConfirmDelete={() => setConfirmDeleteId(p.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreatePipelineDialog onClose={() => setShowCreate(false)} />}
      {showTemplateBrowser && <TemplateBrowser onClose={() => setShowTemplateBrowser(false)} />}
    </div>
  )
}

function PipelineRow({
  pipeline,
  isConfirming,
  isDeleting,
  onClick,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  pipeline: PipelineSummary
  isConfirming: boolean
  isDeleting: boolean
  onClick: () => void
  onDelete: () => Promise<void>
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const lastRun = relativeTime(pipeline.lastRunAt)

  return (
    <div className="group flex min-w-0 flex-col sm:flex-row sm:items-center hover:bg-muted/30 transition-colors">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{pipeline.name}</p>
            {pipeline.category && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                {pipeline.category}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pipeline.agentCount} {pipeline.agentCount === 1 ? 'agent' : 'agents'}
            {pipeline.description && (
              <span className="ml-2 text-muted-foreground/60 truncate max-w-xs inline-block align-bottom">
                {pipeline.description}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
          {lastRun ? (
            <span className="hidden tabular-nums sm:inline">ran {lastRun}</span>
          ) : (
            <span className="hidden text-muted-foreground/50 sm:inline">no runs</span>
          )}
          <PipelineStatusBadge status={pipeline.status} />
        </div>
      </button>

      <div className={cn('flex shrink-0 items-center gap-1 pr-3', !isConfirming && 'hidden group-hover:opacity-100 transition-opacity')}>
        {isConfirming ? (
          <>
            <Button variant="destructive" size="sm" loading={isDeleting} onClick={onDelete}>
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelDelete}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onConfirmDelete}>✕</Button>
        )}
      </div>
    </div>
  )
}
