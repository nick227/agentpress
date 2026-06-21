import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Plus, Rss, Youtube, MessageSquare } from 'lucide-react'
import { useResearchSources } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { groupResearchSources, researchCategoryLabel } from '@/components/layout/explorer/researchCategories'
import { compactRelativeTime } from '@/components/layout/explorer/explorerTime'

type ResearchSource = components['schemas']['ResearchSource']

const SOURCE_ICON: Record<string, React.ReactNode> = {
  youtube: <Youtube size={13} className="text-red-500" />,
  reddit: <MessageSquare size={13} className="text-orange-500" />,
  rss: <Rss size={13} className="text-amber-500" />,
}

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  rss: 'RSS',
}

export function ResearchPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useResearchSources()
  const [search, setSearch] = useState('')

  const allSources = data?.data ?? []
  const filtered = search
    ? allSources.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          researchCategoryLabel(s.category).toLowerCase().includes(search.toLowerCase()) ||
          s.sourceType.includes(search.toLowerCase()),
      )
    : allSources

  const groups = groupResearchSources(filtered)
  const totalActive = allSources.filter((s) => s.status === 'active').length
  const totalItems = allSources.reduce((sum, s) => sum + (s.itemCount ?? 0), 0)

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-lg font-semibold">Research</h1>
          <p className="text-sm text-muted-foreground">
            {allSources.length} source{allSources.length === 1 ? '' : 's'}
            {totalActive > 0 && ` · ${totalActive} active`}
            {totalItems > 0 && ` · ${totalItems.toLocaleString()} items collected`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/research/new')}>
          <Plus size={13} /> Add source
        </Button>
      </div>

      <div className="mt-4 mb-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, category, or type…"
          className="max-w-xs"
        />
      </div>

      {allSources.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No research sources"
          description="Add a YouTube channel, Reddit feed, or RSS source to start collecting research."
          action={{ label: 'Add source', onClick: () => navigate('/research/new') }}
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources match your filter.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground/60">
                  {group.sources.length} source{group.sources.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="divide-y rounded border bg-surface">
                {group.sources.map((source) => (
                  <SourceRow key={source.id} source={source} onClick={() => navigate(`/research/${source.slug}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SourceRow({ source, onClick }: { source: ResearchSource; onClick: () => void }) {
  const isActive = source.status === 'active'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{source.name}</p>
        <p className="text-xs text-muted-foreground truncate">{source.sourceUrl}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {source.itemCount != null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {source.itemCount.toLocaleString()} item{source.itemCount === 1 ? '' : 's'}
          </span>
        )}
        {source.lastChecked && (
          <span className="text-xs text-muted-foreground/70 tabular-nums">
            checked {compactRelativeTime(source.lastChecked)}
          </span>
        )}
        <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {SOURCE_ICON[source.sourceType]}
          {SOURCE_LABEL[source.sourceType] ?? source.sourceType}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
          }`}
        >
          {isActive ? 'Active' : 'Paused'}
        </span>
      </div>
    </button>
  )
}
