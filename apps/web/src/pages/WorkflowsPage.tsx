import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layers, Globe2, Plus } from 'lucide-react'
import { useWorkflows } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type WorkflowSummary = components['schemas']['WorkflowSummary']

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  writing: 'Writing',
  seo: 'SEO',
  finance: 'Finance',
  newsletter: 'Newsletter',
  social: 'Social',
  news: 'News',
  video: 'Video',
  general: 'General',
}

function groupBy(items: WorkflowSummary[]): [string, WorkflowSummary[]][] {
  const map: Record<string, WorkflowSummary[]> = {}
  for (const item of items) {
    const k = item.category ?? 'general'
    ;(map[k] ??= []).push(item)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

export function WorkflowsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useWorkflows()
  const [search, setSearch] = useState('')

  const all = data?.data ?? []
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return all
    return all.filter((w) =>
      [w.name, w.description ?? '', w.category, ...(w.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [all, search])

  const groups = groupBy(filtered)

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-px mt-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Reusable sequences of agent nodes. Insert into any pipeline as a building block.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/community?tab=workflows')}>
            <Globe2 size={13} /> Browse community
          </Button>
          <Button size="sm" onClick={() => navigate('/workflows/new')}>
            <Plus size={13} /> New workflow
          </Button>
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No workflows yet"
          description="Fork community workflow building blocks or create your own reusable sequences."
          action={{ label: 'Browse community', onClick: () => navigate('/community?tab=workflows') }}
        />
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, category, or tags…"
            className="w-full max-w-xs rounded border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflows match your filter.</p>
          ) : (
            <div className="space-y-5">
              {groups.map(([cat, items]) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <div className="divide-y rounded border bg-surface">
                    {items.map((wf) => (
                      <WorkflowRow key={wf.id} workflow={wf} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function WorkflowRow({ workflow }: { workflow: WorkflowSummary }) {
  const isCommunity = workflow.visibility === 'PUBLIC'

  return (
    <Link
      to={`/workflows/${workflow.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <Layers size={14} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{workflow.name}</span>
          {isCommunity && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              community
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {workflow.description ?? `${workflow.nodeCount} node${workflow.nodeCount === 1 ? '' : 's'}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <NodeCountBadge count={workflow.nodeCount} />
        <span className={cn('hidden sm:inline capitalize', isCommunity && 'text-accent/70')}>
          {workflow.category}
        </span>
      </div>
    </Link>
  )
}

function NodeCountBadge({ count }: { count: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
      {count} {count === 1 ? 'node' : 'nodes'}
    </span>
  )
}
