import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useResearchSource, useResearchItems } from '@project/sdk'
import type { components } from '@project/sdk'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ResearchItemPanel } from '@/features/research/ResearchItemPanel'
import { ResearchInfoPanel } from '@/features/research/ResearchInfoPanel'
import { PromptsPanel } from '@/features/research/PromptsPanel'

const ITEMS_PER_PAGE = 15

export function ResearchSourcePage() {
  const { sourceSlug } = useParams<{ sourceSlug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const itemId = searchParams.get('item')

  const { data: sourceData, isLoading: sourceLoading } = useResearchSource(sourceSlug!)
  const source = sourceData?.data

  const { data: itemsData, isLoading: itemsLoading } = useResearchItems(source?.id ?? '', page, ITEMS_PER_PAGE)

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
  }

  let content: React.ReactNode
  if (sourceLoading) {
    content = (
      <div className="h-screen p-6">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  } else if (!source) {
    content = (
      <div className="p-6">
        <p className="text-muted-foreground">Research source not found.</p>
      </div>
    )
  } else if (itemId) {
    content = (
      <div className="page-shell">
        <button type="button" onClick={() => setSearchParams({}, { replace: false })} className="mt-5 text-sm text-muted-foreground hover:text-foreground">← Back to Feed</button>
        <ResearchItemPanel itemId={itemId} sourceSlug={source.slug} sourceType={source.sourceType} />
      </div>
    )
  } else {
    content = (
      <div className="page-shell pb-10">
        <Link to="/" className="mt-5 inline-flex text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <ResearchInfoPanel source={source} />
        <ResearchItemsSection
          sourceType={source.sourceType}
          items={itemsData?.data ?? []}
          total={itemsData?.total ?? 0}
          page={page}
          pages={itemsData?.pages ?? 1}
          loading={itemsLoading}
          onSelect={(id) => setSearchParams({ item: id }, { replace: false })}
          onPageChange={handlePageChange}
        />
        <div className="border-t"><PromptsPanel /></div>
      </div>
    )
  }

  return content
}

function ResearchItemsSection({ sourceType, items, total, page, pages, loading, onSelect, onPageChange }: {
  sourceType: string
  items: components['schemas']['ResearchItem'][]
  total: number
  page: number
  pages: number
  loading: boolean
  onSelect: (id: string) => void
  onPageChange: (page: number) => void
}) {
  return (
    <section className="page-shell page-shell--2xl pb-8 pt-0">
      <div className="mb-3"><h2 className="text-sm font-semibold">Collected items</h2><p className="text-xs text-muted-foreground">{total} item{total === 1 ? '' : 's'}, newest first.</p></div>
      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : items.length === 0 ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">No items collected yet.</div>
      ) : <div className="divide-y rounded border bg-surface">{items.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{item.title}</p><p className="text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString()} · {item.summaryCount ?? 0} summaries</p></div>
          {item.contentStatus && item.contentStatus !== 'ok' && <span className="text-[10px] text-amber-700">{sourceType === 'youtube' ? 'Transcript issue' : item.contentStatus}</span>}
          <span className="text-muted-foreground">›</span>
        </button>
      ))}</div>}
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronLeft size={14} /></button><span className="text-xs text-muted-foreground">{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight size={14} /></button></div>}
    </section>
  )
}
