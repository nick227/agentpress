import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageSquareText, Plus } from 'lucide-react'
import { useDeletePrompt, usePrompts } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowDeleteControls, useDeleteConfirm } from '@/components/ui/RowDeleteControls'
import { cn } from '@/lib/utils'
import { CommunityBrowser } from '@/features/content/CommunityBrowser'

type Prompt = components['schemas']['Prompt']
type PromptKind = Prompt['kind']

const KIND_LABEL: Record<PromptKind, string> = {
  TRANSFORMATIONAL: 'Transformational',
  CONTENT: 'Content',
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function PromptsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialKind = searchParams.get('kind') === 'CONTENT' ? 'CONTENT' : searchParams.get('kind') === 'TRANSFORMATIONAL' ? 'TRANSFORMATIONAL' : 'all'
  const { data, isLoading } = usePrompts()
  const deletePrompt = useDeletePrompt()
  const { propsFor } = useDeleteConfirm(deletePrompt)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<PromptKind | 'all'>(initialKind)
  const [showCommunity, setShowCommunity] = useState(false)

  const all = data?.data ?? []
  const prompts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return all.filter((prompt) => {
      if (kindFilter !== 'all' && prompt.kind !== kindFilter) return false
      if (!needle) return true
      const haystack = [
        prompt.name,
        prompt.description ?? '',
        prompt.category,
        ...(prompt.tags ?? []),
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [all, kindFilter, search])

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-px mt-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Prompts</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} reusable text pair{all.length === 1 ? '' : 's'} for Agents and research
          </p>
        </div>
        <div className="page-header-actions">
          <Button size="sm" variant="outline" onClick={() => setShowCommunity(true)}>
            Browse Community
          </Button>
          <Button size="sm" onClick={() => navigate('/prompts/new')}>
            <Plus size={13} /> New Prompt
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, category, or tags…"
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(['all', 'TRANSFORMATIONAL', 'CONTENT'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKindFilter(value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                kindFilter === value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'all' ? 'All' : KIND_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No prompts yet"
          description="Create reusable prompts for pipelines and research, or browse community templates after seeding."
          action={{ label: 'Create prompt', onClick: () => navigate('/prompts/new') }}
        />
      ) : prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prompts match your filter.</p>
      ) : (
        <div className="divide-y rounded border bg-surface">
          {prompts.map((prompt) => (
            <PromptRow
              key={prompt.id}
              prompt={prompt}
              onClick={() => navigate(`/prompts/${prompt.slug}`)}
              {...propsFor(prompt.id, prompt.name)}
            />
          ))}
        </div>
      )}

      {showCommunity && <CommunityBrowser defaultTab="prompts" onClose={() => setShowCommunity(false)} />}
    </div>
  )
}

function PromptRow({
  prompt,
  onClick,
  isConfirming,
  isDeleting,
  onConfirm,
  onCancel,
  onDelete,
}: {
  prompt: Prompt
  onClick: () => void
  isConfirming: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
  onDelete: () => Promise<void>
}) {
  const isCommunity = prompt.visibility === 'PUBLIC'

  return (
    <div className="group flex items-center hover:bg-muted/30 transition-colors">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'mt-px h-2 w-2 shrink-0 rounded-full',
            prompt.kind === 'TRANSFORMATIONAL' ? 'bg-violet-500' : 'bg-sky-500',
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{prompt.name}</p>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[prompt.kind]}
            </span>
            {isCommunity && (
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                community
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {prompt.description ?? prompt.userPrompt}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{prompt.category}</span>
          <span className="hidden md:inline tabular-nums text-muted-foreground/50">
            updated {relativeDate(prompt.updatedAt)}
          </span>
        </div>
      </button>

      {!isCommunity && (
        <RowDeleteControls
          isConfirming={isConfirming}
          isDeleting={isDeleting}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
