import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { usePipeline } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { FocusSidebarHeader } from '@/components/layout/FocusSidebarHeader'
import { SidebarPortal } from '@/components/layout/SidebarPortal'
import { useShellChrome } from '@/components/layout/Shell'
import { BuilderSidebar } from '@/features/pipelines/builder/BuilderSidebar'
import { DetailPanel } from '@/features/pipelines/builder/DetailPanel'
import {
  PipelineSelectionProvider,
  type Selection,
} from '@/features/pipelines/builder/pipelineSelectionContext'

const PIPELINE_SHELL_CHROME = {
  customSidebar: true,
  mainClassName: 'max-w-none mx-0 overflow-hidden',
} as const


export function PipelineBuilderPage() {
  const { accountSlug, pipelineSlug } = useParams<{ accountSlug: string; pipelineSlug: string }>()
  const [searchParams] = useSearchParams()
  const { data, isLoading } = usePipeline(pipelineSlug!)
  const [selection, setSelection] = useState<Selection>(() => {
    const runId = searchParams.get('run')
    return runId ? { type: 'run', id: runId } : { type: 'setup' }
  })

  const pipeline = data?.data
  const recentRuns = useMemo(() => data?.recentRuns ?? [], [data?.recentRuns])
  const sidebar = useMemo(() => {
    if (isLoading) {
      return <FocusSidebarSkeleton rows={4} />
    }

    if (!pipeline) {
      return (
        <FocusSidebarHeader
          accountSlug={accountSlug!}
          title="Pipeline not found"
          eyebrow="Pipeline"
          allHref={`/accounts/${accountSlug}#pipelines`}
          allLabel="All Pipelines"
        />
      )
    }

    return (
      <>
        <FocusSidebarHeader
          accountSlug={accountSlug!}
          title={pipeline.name}
          eyebrow="Pipeline"
          allHref={`/accounts/${accountSlug}#pipelines`}
          allLabel="All Pipelines"
        />
        <BuilderSidebar pipeline={pipeline} runs={recentRuns} pipelineId={pipelineSlug!} />
      </>
    )
  }, [accountSlug, isLoading, pipeline, pipelineSlug, recentRuns])

  useShellChrome(PIPELINE_SHELL_CHROME)

  let content: React.ReactNode
  if (isLoading) {
    content = (
      <div className="h-screen p-6">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  } else if (!pipeline) {
    content = (
      <div className="p-6">
        <p className="text-muted-foreground">Pipeline not found.</p>
      </div>
    )
  } else {
    content = (
      <div className="h-screen overflow-hidden bg-background">
        <div className="h-full overflow-auto">
          <DetailPanel pipeline={pipeline} runs={recentRuns} pipelineId={pipelineSlug!} />
        </div>
      </div>
    )
  }

  return (
    <PipelineSelectionProvider selection={selection} onSelect={setSelection}>
      <SidebarPortal>{sidebar}</SidebarPortal>
      {content}
    </PipelineSelectionProvider>
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
