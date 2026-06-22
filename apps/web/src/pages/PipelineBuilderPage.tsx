import { useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { usePipeline } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { DetailPanel } from '@/features/pipelines/builder/DetailPanel'
import {
  PipelineSelectionProvider,
  type Selection,
} from '@/features/pipelines/builder/pipelineSelectionContext'

export function PipelineBuilderPage() {
  const { pipelineSlug } = useParams<{ pipelineSlug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading } = usePipeline(pipelineSlug!)

  const pipeline = data?.data
  const recentRuns = useMemo(() => data?.recentRuns ?? [], [data?.recentRuns])
  const selection = useMemo<Selection>(() => {
    const view = searchParams.get('view')
    if (view === 'workflow-editor') return { type: 'workflow-editor' }
    const variableId = searchParams.get('variable')
    const agentId = searchParams.get('agent')
    const runId = searchParams.get('run')
    if (variableId) return { type: 'variable', id: variableId }
    if (agentId) return { type: 'agent', id: agentId }
    if (runId) return { type: 'run', id: runId }
    return { type: 'setup' }
  }, [searchParams])

  function handleSelect(next: Selection) {
    if (next.type === 'setup') {
      setSearchParams({}, { replace: false })
      return
    }
    if (next.type === 'workflow-editor') {
      setSearchParams({ view: 'workflow-editor' }, { replace: false })
      return
    }
    setSearchParams({ [next.type]: next.id }, { replace: false })
  }

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
    const isCommunity = pipeline.visibility === 'PUBLIC'
    content = (
      <div className="min-h-full w-full min-w-0 bg-background flex flex-col">
        {isCommunity && (
          <div className="bg-muted p-2 text-center text-xs text-muted-foreground border-b flex justify-between items-center px-4 shrink-0">
             <span><Link to="/community" className="hover:underline">← Community</Link></span>
             <span>Community pipeline — read-only template. Fork this pipeline from the community page to edit and run it.</span>
             <span className="w-16"></span>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          <DetailPanel pipeline={pipeline} runs={recentRuns} pipelineId={pipelineSlug!} />
        </div>
      </div>
    )
  }

  return (
    <PipelineSelectionProvider selection={selection} onSelect={handleSelect}>
      {content}
    </PipelineSelectionProvider>
  )
}
