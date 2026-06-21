import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
    content = (
      <div className="min-h-full w-full min-w-0 bg-background">
        <DetailPanel pipeline={pipeline} runs={recentRuns} pipelineId={pipelineSlug!} />
      </div>
    )
  }

  return (
    <PipelineSelectionProvider selection={selection} onSelect={handleSelect}>
      {content}
    </PipelineSelectionProvider>
  )
}
