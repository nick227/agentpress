import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useResearchSource, useResearchItems } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { FocusSidebarHeader } from '@/components/layout/FocusSidebarHeader'
import { SidebarPortal } from '@/components/layout/SidebarPortal'
import { useShellChrome } from '@/components/layout/Shell'
import { ResearchSidebar } from '@/features/research/ResearchSidebar'
import { ResearchItemPanel } from '@/features/research/ResearchItemPanel'
import { ResearchInfoPanel } from '@/features/research/ResearchInfoPanel'
import { PromptsPanel } from '@/features/research/PromptsPanel'
import {
  ResearchPageProvider,
  type ResearchSelection,
} from '@/features/research/researchPageContext'


const ITEMS_PER_PAGE = 15

const RESEARCH_SHELL_CHROME = {
  customSidebar: true,
  mainClassName: 'max-w-none mx-0 overflow-hidden',
} as const

export function ResearchSourcePage() {
  const { accountSlug, sourceSlug } = useParams<{ accountSlug: string; sourceSlug: string }>()
  const [selection, setSelection] = useState<ResearchSelection>({ type: 'info' })
  const [page, setPage] = useState(1)

  const { data: sourceData, isLoading: sourceLoading } = useResearchSource(sourceSlug!)
  const source = sourceData?.data

  const { data: itemsData, isLoading: itemsLoading } = useResearchItems(source?.id ?? '', page, ITEMS_PER_PAGE)

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    setSelection({ type: 'info' })
  }

  const sidebar = useMemo(() => {
    if (sourceLoading) {
      return <FocusSidebarSkeleton rows={3} />
    }

    if (!source) {
      return (
        <FocusSidebarHeader
          accountSlug={accountSlug!}
          title="Research source not found"
          eyebrow="Research"
          allHref={`/accounts/${accountSlug}#research`}
          allLabel="All Research"
        />
      )
    }

    return (
      <>
        <FocusSidebarHeader
          accountSlug={accountSlug!}
          title={source.name}
          eyebrow="Research"
          allHref={`/accounts/${accountSlug}#research`}
          allLabel="All Research"
        />
        <ResearchSidebar
          source={source}
          itemsPage={itemsData}
          itemsLoading={itemsLoading}
        />
      </>
    )
  }, [accountSlug, itemsData, itemsLoading, source, sourceLoading])

  useShellChrome(RESEARCH_SHELL_CHROME)

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
  } else {
    content = (
      <div className="h-screen overflow-auto bg-background">
        <div className="max-w-4xl mx-auto">
          {selection.type === 'info' && <ResearchInfoPanel source={source} accountSlug={accountSlug!} />}
          {selection.type === 'prompts' && <PromptsPanel />}
          {selection.type === 'item' && (
            <ResearchItemPanel
              itemId={selection.id}
              sourceSlug={source.slug}
              sourceType={source.sourceType}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <ResearchPageProvider
      selection={selection}
      onSelect={setSelection}
      page={page}
      onPageChange={handlePageChange}
    >
      <SidebarPortal>{sidebar}</SidebarPortal>
      {content}
    </ResearchPageProvider>
  )
}

function FocusSidebarSkeleton({ rows }: { rows: number }) {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={i === 1 ? 'h-4 w-3/4' : 'h-4 w-full'} />
      ))}
    </div>
  )
}
