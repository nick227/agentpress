import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useResearchSource, useResearchItems } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { ResearchSidebar } from '@/features/research/ResearchSidebar'
import { ResearchItemPanel } from '@/features/research/ResearchItemPanel'
import { ResearchInfoPanel } from '@/features/research/ResearchInfoPanel'
import { PromptsPanel } from '@/features/research/PromptsPanel'

export type ResearchSelection = { type: 'info' } | { type: 'prompts' } | { type: 'item'; id: string }

const ITEMS_PER_PAGE = 15

export function ResearchSourcePage() {
  const { accountSlug, sourceSlug } = useParams<{ accountSlug: string; sourceSlug: string }>()
  const navigate = useNavigate()
  const [selection, setSelection] = useState<ResearchSelection>({ type: 'info' })
  const [page, setPage] = useState(1)

  const { data: sourceData, isLoading: sourceLoading } = useResearchSource(sourceSlug!)
  const source = sourceData?.data

  const { data: itemsData, isLoading: itemsLoading } = useResearchItems(source?.id ?? '', page, ITEMS_PER_PAGE)

  if (sourceLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-60 border-r p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!source) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Research source not found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="w-60 shrink-0 border-r bg-surface flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/accounts/${accountSlug}`)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ChevronLeft size={12} />
            {accountSlug}
          </button>
          <p className="text-sm font-semibold truncate">{source.name}</p>
        </div>
        <ResearchSidebar
          source={source}
          itemsPage={itemsData}
          itemsLoading={itemsLoading}
          page={page}
          onPageChange={(p) => { setPage(p); setSelection({ type: 'info' }) }}
          selection={selection}
          onSelect={setSelection}
        />
      </div>

      <div className="flex-1 overflow-auto max-w-4xl mx-auto">
        {selection.type === 'info' && <ResearchInfoPanel source={source} accountSlug={accountSlug!} />}
        {selection.type === 'prompts' && <PromptsPanel />}
        {selection.type === 'item' && <ResearchItemPanel itemId={selection.id} sourceSlug={source.slug} sourceType={source.sourceType} />}
      </div>
    </div>
  )
}
