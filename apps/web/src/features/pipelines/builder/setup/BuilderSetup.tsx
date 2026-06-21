import { useEffect, useRef, useState } from 'react'
import type { components } from '@project/sdk'
import {
  AgentsSection,
  DestinationSection,
  PipelineNameField,
  PipelineSettingsSection,
  RunsSection,
  VariablesSection,
} from './BuilderSetupSections'
import { RunPipelineControls } from './RunPipelineControls'
import { LoopConfig } from './LoopConfig'

type Pipeline = components['schemas']['Pipeline']
type Run = components['schemas']['PipelineRun']

interface Props {
  pipeline: Pipeline
  pipelineId: string
  runs: Run[]
  onRunCreated: (runId: string) => void
}

function useRunDefaults(pipeline: Pipeline) {
  const [runTitle, setRunTitle] = useState(pipeline.name)
  const [dryRun, setDryRun] = useState(pipeline.dryRun)
  const previousPipelineId = useRef(pipeline.id)
  const previousPipelineName = useRef(pipeline.name)

  useEffect(() => setDryRun(pipeline.dryRun), [pipeline.dryRun])
  useEffect(() => {
    const switchedPipeline = previousPipelineId.current !== pipeline.id
    const previousName = previousPipelineName.current
    setRunTitle((current) => switchedPipeline || !current.trim() || current === previousName ? pipeline.name : current)
    previousPipelineId.current = pipeline.id
    previousPipelineName.current = pipeline.name
  }, [pipeline.id, pipeline.name])

  function handlePipelineRenamed(nextName: string, previousName: string) {
    setRunTitle((current) => !current.trim() || current === previousName ? nextName : current)
  }

  return { runTitle, setRunTitle, dryRun, setDryRun, handlePipelineRenamed }
}

export function BuilderSetup({ pipeline, pipelineId, runs, onRunCreated }: Props) {
  const runDefaults = useRunDefaults(pipeline)

  return (
    <div className="min-h-full flex flex-col">
      <div className="p-6">
        <div className="max-w-6xl space-y-6">
          <PipelineNameField pipeline={pipeline} pipelineId={pipelineId} onRenamed={runDefaults.handlePipelineRenamed} />
          <div className="space-y-6">
            <DestinationSection pipeline={pipeline} pipelineId={pipelineId} />
            <PipelineSettingsSection
              pipeline={pipeline}
              pipelineId={pipelineId}
              runTitle={runDefaults.runTitle}
              onRunTitleChange={runDefaults.setRunTitle}
              onDryRunChange={runDefaults.setDryRun}
            />
            <VariablesSection pipeline={pipeline} pipelineId={pipelineId} />
            <AgentsSection pipeline={pipeline} pipelineId={pipelineId} />
            <LoopConfig pipeline={pipeline} pipelineId={pipelineId} />
            <RunsSection pipeline={pipeline} runs={runs} />
          </div>
        </div>
      </div>
      <RunPipelineControls
        pipeline={pipeline}
        pipelineId={pipelineId}
        runTitle={runDefaults.runTitle}
        dryRun={runDefaults.dryRun}
        onDryRunChange={runDefaults.setDryRun}
        onRunCreated={onRunCreated}
      />
    </div>
  )
}
