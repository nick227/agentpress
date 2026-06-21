import { useState } from 'react'
import { Globe, Layers, Play, Zap } from 'lucide-react'
import type { components } from '@project/sdk'
import { useDestinations, useStartPipelineRun, usePreviewBatch, useStartBatch } from '@project/sdk'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BatchPreviewModal } from './BatchPreviewModal'

type Pipeline = components['schemas']['Pipeline']
type Destination = components['schemas']['Destination']
type BatchPreview = components['schemas']['BatchPreview']

interface Props {
  pipeline: Pipeline
  pipelineId: string
  runTitle: string
  dryRun: boolean
  onDryRunChange: (dryRun: boolean) => void
  onRunCreated: (runId: string) => void
}

export function RunPipelineControls(props: Props) {
  const isBatchMode = Boolean(props.pipeline.loop)
  const startRun = useStartPipelineRun()
  const previewBatch = usePreviewBatch()
  const startBatch = useStartBatch()
  const { data } = useDestinations()
  const [open, setOpen] = useState(false)
  const [batchPreview, setBatchPreview] = useState<BatchPreview | null>(null)
  const [forceRegenerate, setForceRegenerate] = useState(false)
  const [forcedAgentUids, setForcedAgentUids] = useState<string[]>([])
  const [runVariables, setRunVariables] = useState<Record<string, string>>(() => getRunVariableDefaults(props.pipeline))
  const destination = (data?.data ?? []).find((item) => item.id === props.pipeline.destinationId)

  async function handleRunClick() {
    if (isBatchMode) {
      try {
        const result = await previewBatch.mutateAsync({ pipelineId: props.pipelineId })
        setBatchPreview(result.data)
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to preview batch')
      }
    } else {
      setOpen(true)
    }
  }

  async function handleRun() {
    const result = await startRun.mutateAsync({
      pipelineId: props.pipelineId,
      variables: runVariables,
      dryRun: props.dryRun,
      title: props.runTitle.trim() || props.pipeline.name,
      forceRegenerate,
      forceRegenerateAgentUids: forceRegenerate ? undefined : forcedAgentUids,
    })
    toast.success(props.dryRun ? 'Dry run started' : 'Live run started')
    setOpen(false)
    setForceRegenerate(false)
    setForcedAgentUids([])
    props.onRunCreated(result.data.id)
  }

  async function handleBatchConfirm() {
    await startBatch.mutateAsync({
      pipelineId: props.pipelineId,
      dryRun: props.dryRun,
    })
    toast.success(`Batch started — ${batchPreview?.itemCount ?? 0} runs queued`)
    setBatchPreview(null)
  }

  function toggleAgent(uid: string) {
    setForcedAgentUids((current) => current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid])
  }

  const runLabel = isBatchMode ? 'Run batch' : 'Run'
  const modeLabel = isBatchMode
    ? `Batch mode · ${props.dryRun ? 'dry' : 'live'}`
    : (props.pipeline.dryRun ? 'Dry run mode' : 'Live run mode')

  return (
    <>
      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3">
        <div className="max-w-6xl flex items-center justify-end gap-4">
          <p className="min-w-0 text-xs text-muted-foreground truncate">{modeLabel}</p>
          <Button
            onClick={handleRunClick}
            size="sm"
            className="gap-1.5 shrink-0"
            loading={previewBatch.isPending}
          >
            {isBatchMode ? <Layers size={13} /> : <Play size={13} />}
            {runLabel}
          </Button>
        </div>
      </div>

      {open && (
        <RunPipelineDialog
          {...props}
          destination={destination}
          runVariables={runVariables}
          onRunVariablesChange={setRunVariables}
          forceRegenerate={forceRegenerate}
          onForceRegenerateChange={setForceRegenerate}
          forcedAgentUids={forcedAgentUids}
          onToggleAgent={toggleAgent}
          pending={startRun.isPending}
          onRun={handleRun}
          onClose={() => setOpen(false)}
        />
      )}

      {batchPreview && props.pipeline.loop && (
        <BatchPreviewModal
          preview={batchPreview}
          loop={props.pipeline.loop}
          dryRun={props.dryRun}
          pending={startBatch.isPending}
          onConfirm={handleBatchConfirm}
          onCancel={() => setBatchPreview(null)}
        />
      )}
    </>
  )
}

interface DialogProps extends Props {
  destination?: Destination
  runVariables: Record<string, string>
  onRunVariablesChange: (variables: Record<string, string>) => void
  forceRegenerate: boolean
  onForceRegenerateChange: (force: boolean) => void
  forcedAgentUids: string[]
  onToggleAgent: (uid: string) => void
  pending: boolean
  onRun: () => void
  onClose: () => void
}

function RunPipelineDialog(props: DialogProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-sm shadow-lg">
        <DialogHeader onClose={props.onClose} />
        <div className="p-5 space-y-4">
          {props.destination && <DestinationSummary destination={props.destination} />}
          <RunVariables pipeline={props.pipeline} values={props.runVariables} onChange={props.onRunVariablesChange} />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={props.dryRun} onChange={(event) => props.onDryRunChange(event.target.checked)} />
            Dry run (preview only, don't publish)
          </label>
          <RegenerationOptions pipeline={props.pipeline} forceAll={props.forceRegenerate} forcedAgentUids={props.forcedAgentUids} onForceAllChange={props.onForceRegenerateChange} onToggleAgent={props.onToggleAgent} />
        </div>
        <div className="px-5 pb-4 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={props.onClose}>Cancel</Button>
          <Button size="sm" loading={props.pending} onClick={props.onRun} className="gap-1.5"><Zap size={13} />{props.dryRun ? 'Run dry' : 'Run live'}</Button>
        </div>
      </div>
    </div>
  )
}

function DialogHeader({ onClose }: { onClose: () => void }) {
  return <div className="px-5 py-4 border-b flex items-center justify-between"><h3 className="text-sm font-semibold">Run Pipeline</h3><Button variant="ghost" size="icon-sm" onClick={onClose}>×</Button></div>
}

function DestinationSummary({ destination }: { destination: Destination }) {
  return <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-2.5 py-2 border"><Globe size={12} /><span className="font-medium text-foreground">{destination.name}</span><span className="truncate">{destination.siteUrl}</span></div>
}

function RunVariables({ pipeline, values, onChange }: { pipeline: Pipeline; values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  if (pipeline.variables.length === 0) return <p className="text-sm text-muted-foreground">No variables required.</p>
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Variable values</p>
      {pipeline.variables.map((variable) => (
        <div key={variable.key} className="space-y-1">
          <label className="text-xs font-medium text-foreground">{variable.label || variable.key}{variable.required && <span className="text-destructive ml-0.5">*</span>}</label>
          <Input value={values[variable.key] ?? ''} onChange={(event) => onChange({ ...values, [variable.key]: event.target.value })} placeholder={String(variable.exampleValue ?? variable.defaultValue ?? '')} />
        </div>
      ))}
    </div>
  )
}

function RegenerationOptions({ pipeline, forceAll, forcedAgentUids, onForceAllChange, onToggleAgent }: {
  pipeline: Pipeline
  forceAll: boolean
  forcedAgentUids: string[]
  onForceAllChange: (force: boolean) => void
  onToggleAgent: (uid: string) => void
}) {
  return (
    <div className="border rounded p-3 bg-muted/20 space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" checked={forceAll} onChange={(event) => onForceAllChange(event.target.checked)} />Force regenerate all outputs</label>
      {!forceAll && pipeline.agents.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Force selected agents</p>
          <div className="flex flex-wrap gap-1.5">
            {pipeline.agents.map((agent) => <ForceAgentButton key={agent.uid} uid={agent.uid} active={forcedAgentUids.includes(agent.uid)} onClick={() => onToggleAgent(agent.uid)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function ForceAgentButton({ uid, active, onClick }: { uid: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`px-2 py-1 rounded border text-xs transition-colors ${active ? 'bg-foreground text-background border-foreground' : 'border-input-border hover:bg-muted'}`}>{uid}</button>
}

function getRunVariableDefaults(pipeline: Pipeline) {
  return Object.fromEntries(pipeline.variables.map((variable) => [variable.key, String(variable.defaultValue ?? variable.exampleValue ?? '')]))
}
