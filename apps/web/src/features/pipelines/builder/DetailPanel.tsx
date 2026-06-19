import { lazy, Suspense } from 'react'
import type { components } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePipelineSelection } from '@/features/pipelines/builder/pipelineSelectionContext'

const BuilderSetup = lazy(() =>
  import('./setup/BuilderSetup').then((m) => ({ default: m.BuilderSetup })),
)
const BuilderVariable = lazy(() =>
  import('./variables/BuilderVariable').then((m) => ({ default: m.BuilderVariable })),
)
const BuilderAgent = lazy(() =>
  import('./agents/BuilderAgent').then((m) => ({ default: m.BuilderAgent })),
)
const BuilderRun = lazy(() =>
  import('./runs/BuilderRun').then((m) => ({ default: m.BuilderRun })),
)

type Pipeline = components['schemas']['Pipeline']
type Run = components['schemas']['PipelineRun']

interface Props {
  pipeline: Pipeline
  runs: Run[]
  pipelineId: string
}

function PanelFallback() {
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function DetailPanel({ pipeline, runs, pipelineId }: Props) {
  const { selection, onSelect } = usePipelineSelection()

  if (selection.type === 'setup') {
    return (
      <Suspense fallback={<PanelFallback />}>
        <BuilderSetup
          pipeline={pipeline}
          pipelineId={pipelineId}
          onRunCreated={(id) => onSelect({ type: 'run', id })}
        />
      </Suspense>
    )
  }

  if (selection.type === 'variable') {
    const variable = pipeline.variables.find((v) => v.id === selection.id)
    if (!variable) return <Placeholder text="Variable not found" />
    return (
      <Suspense fallback={<PanelFallback />}>
        <BuilderVariable
          key={variable.id}
          variable={variable}
          pipeline={pipeline}
          pipelineId={pipelineId}
          onSaved={(id) => onSelect({ type: 'variable', id })}
          onDeleted={() => onSelect({ type: 'setup' })}
        />
      </Suspense>
    )
  }

  if (selection.type === 'agent') {
    const agent = pipeline.agents.find((a) => a.id === selection.id)
    if (!agent) return <Placeholder text="Agent not found" />
    return (
      <Suspense fallback={<PanelFallback />}>
        <BuilderAgent
          key={agent.id}
          agent={agent}
          pipeline={pipeline}
          pipelineId={pipelineId}
          onSaved={(id) => onSelect({ type: 'agent', id })}
          onDeleted={() => onSelect({ type: 'setup' })}
        />
      </Suspense>
    )
  }

  if (selection.type === 'run') {
    return (
      <Suspense fallback={<PanelFallback />}>
        <BuilderRun runId={selection.id} pipeline={pipeline} />
      </Suspense>
    )
  }

  return null
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      {text}
    </div>
  )
}
