import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { usePipeline } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { BuilderSidebar } from '@/features/pipelines/builder/BuilderSidebar'
import { DetailPanel } from '@/features/pipelines/builder/DetailPanel'

export type Selection =
  | { type: 'setup' }
  | { type: 'variable'; id: string }
  | { type: 'agent'; id: string }
  | { type: 'run'; id: string }

export function PipelineBuilderPage() {
  const { accountSlug, pipelineSlug } = useParams<{ accountSlug: string; pipelineSlug: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = usePipeline(pipelineSlug!)
  const [selection, setSelection] = useState<Selection>({ type: 'setup' })

  const pipeline = data?.data
  const recentRuns = data?.recentRuns ?? []

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-60 border-r p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Pipeline not found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Builder sidebar */}
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
          <p className="text-sm font-semibold truncate">{pipeline.name}</p>
        </div>
        <BuilderSidebar
          pipeline={pipeline}
          runs={recentRuns}
          selection={selection}
          onSelect={setSelection}
          pipelineId={pipelineSlug!}
        />
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-auto">
        <DetailPanel
          pipeline={pipeline}
          runs={recentRuns}
          selection={selection}
          onSelect={setSelection}
          pipelineId={pipelineSlug!}
        />
      </div>
    </div>
  )
}
