import { useParams, Link } from 'react-router-dom'
import { usePipelineRun, usePipeline } from '@project/sdk'
import { BuilderRun } from '@/features/pipelines/builder/runs/BuilderRun'
import { Skeleton } from '@/components/ui/Skeleton'
import { ArrowLeft, Workflow } from 'lucide-react'

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const { data: runData, isLoading: runLoading, isError: runError } = usePipelineRun(runId!)
  const pipelineId = runData?.data?.pipelineId
  const { data: pipelineData, isError: pipelineError } = usePipeline(pipelineId ?? '')

  const pipeline = pipelineData?.data

  // Show skeleton while: run is still loading, or run loaded but pipeline not yet resolved
  const stillLoading = runLoading || (!!pipelineId && !pipeline && !pipelineError)
  if (stillLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (runError || !runData?.data) {
    return (
      <div className="page-shell">
        <p className="text-sm text-muted-foreground">Run not found or could not be loaded.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Run ID: {runId}</p>
      </div>
    )
  }

  if (pipelineError || !pipeline) {
    return (
      <div className="page-shell">
        <p className="text-sm text-muted-foreground">Could not load pipeline for this run.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-5 pb-1 text-xs text-muted-foreground">
        <Link to="/runs" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft size={11} />
          Runs
        </Link>
        <span>/</span>
        <Link to={`/pipelines/${pipeline.slug}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Workflow size={11} />
          {pipeline.name}
        </Link>
      </div>
      <BuilderRun runId={runId!} pipeline={pipeline} />
    </div>
  )
}
