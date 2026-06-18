import type { components } from '@project/sdk'
import type { Selection } from '@/pages/PipelineBuilderPage'
import { BuilderSetup } from './setup/BuilderSetup'
import { BuilderVariable } from './variables/BuilderVariable'
import { BuilderAgent } from './agents/BuilderAgent'
import { BuilderRun } from './runs/BuilderRun'
import { BuilderComposer } from './composer/BuilderComposer'

type Pipeline = components['schemas']['Pipeline']
type Run = components['schemas']['PipelineRun']

interface Props {
  pipeline: Pipeline
  runs: Run[]
  selection: Selection
  onSelect: (s: Selection) => void
  pipelineId: string
}

export function DetailPanel({ pipeline, runs, selection, onSelect, pipelineId }: Props) {
  if (selection.type === 'setup') {
    return <BuilderSetup pipeline={pipeline} pipelineId={pipelineId} onRunCreated={(id) => onSelect({ type: 'run', id })} />
  }

  if (selection.type === 'composer') {
    return <BuilderComposer pipeline={pipeline} pipelineId={pipelineId} />
  }

  if (selection.type === 'variable') {
    const variable = pipeline.variables.find((v) => v.id === selection.id)
    if (!variable) return <Placeholder text="Variable not found" />
    return (
      <BuilderVariable
        key={variable.id}
        variable={variable}
        pipeline={pipeline}
        pipelineId={pipelineId}
        onSaved={(id) => onSelect({ type: 'variable', id })}
        onDeleted={() => onSelect({ type: 'setup' })}
      />
    )
  }

  if (selection.type === 'agent') {
    const agent = pipeline.agents.find((a) => a.id === selection.id)
    if (!agent) return <Placeholder text="Agent not found" />
    return (
      <BuilderAgent
        key={agent.id}
        agent={agent}
        pipeline={pipeline}
        pipelineId={pipelineId}
        onSaved={(id) => onSelect({ type: 'agent', id })}
        onDeleted={() => onSelect({ type: 'setup' })}
      />
    )
  }

  if (selection.type === 'run') {
    return <BuilderRun runId={selection.id} pipeline={pipeline} />
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
