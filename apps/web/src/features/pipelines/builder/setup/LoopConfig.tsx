import { useState, useEffect, type ReactNode } from 'react'
import type { components } from '@project/sdk'
import {
  useResearchSources,
  useUpsertPipelineLoop,
  useDeletePipelineLoop,
} from '@project/sdk'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

type Pipeline = components['schemas']['Pipeline']
type PipelineLoop = components['schemas']['PipelineLoop']

type CursorMode = 'all_stored' | 'new_since_cursor' | 'date_range'

interface Props {
  pipeline: Pipeline
  pipelineId: string
}

export function LoopConfig({ pipeline, pipelineId }: Props) {
  const loop = pipeline.loop ?? null
  const isEnabled = loop !== null && loop !== undefined

  const upsert = useUpsertPipelineLoop()
  const remove = useDeletePipelineLoop()
  const { data: sourcesData } = useResearchSources()
  const sources = sourcesData?.data ?? []

  const [sourceId, setSourceId] = useState(loop?.sourceId ?? '')
  const [cursorMode, setCursorMode] = useState<CursorMode>((loop?.cursorMode as CursorMode) ?? 'all_stored')
  const [dateRangeStart, setDateRangeStart] = useState(loop?.dateRangeStart ? toDateInput(loop.dateRangeStart) : '')
  const [dateRangeEnd, setDateRangeEnd] = useState(loop?.dateRangeEnd ? toDateInput(loop.dateRangeEnd) : '')
  const [maxBatchSize, setMaxBatchSize] = useState(loop?.maxBatchSize ?? 50)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSourceId(loop?.sourceId ?? '')
    setCursorMode((loop?.cursorMode as CursorMode) ?? 'all_stored')
    setDateRangeStart(loop?.dateRangeStart ? toDateInput(loop.dateRangeStart) : '')
    setDateRangeEnd(loop?.dateRangeEnd ? toDateInput(loop.dateRangeEnd) : '')
    setMaxBatchSize(loop?.maxBatchSize ?? 50)
    setDirty(false)
  }, [pipeline.id])

  if (loop?.loopType === 'dataset') return null

  async function handleEnable() {
    await upsert.mutateAsync({
      pipelineId,
      loopType: 'research_feed',
      sourceId: sources[0]?.id ?? '',
      cursorMode: 'all_stored',
      maxBatchSize: 50,
    })
    toast.success('Batch loop enabled')
  }

  async function handleDisable() {
    await remove.mutateAsync(pipelineId)
    toast.success('Batch loop removed')
    setDirty(false)
  }

  async function handleSave() {
    if (!sourceId) {
      toast.error('Select a research source')
      return
    }
    if (cursorMode === 'date_range' && (!dateRangeStart || !dateRangeEnd)) {
      toast.error('Date range requires start and end dates')
      return
    }
    await upsert.mutateAsync({
      pipelineId,
      loopType: 'research_feed',
      sourceId,
      cursorMode,
      dateRangeStart: cursorMode === 'date_range' ? new Date(dateRangeStart).toISOString() : undefined,
      dateRangeEnd: cursorMode === 'date_range' ? new Date(dateRangeEnd).toISOString() : undefined,
      maxBatchSize,
    })
    toast.success('Batch config saved')
    setDirty(false)
  }
  
  function Row({ label, children }: { label: string; children: ReactNode }) {
    return <div className="flex items-start gap-3"><span className="text-xs text-muted-foreground w-20 shrink-0 pt-1.5">{label}</span><div className="flex-1">{children}</div></div>
  }

  return (
      <Row label="Loop mode">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <ModeToggle enabled={isEnabled} onEnable={handleEnable} onDisable={handleDisable} pending={upsert.isPending || remove.isPending} />
        </label>
      </Row>
  )
}

function ModeToggle({ enabled, onEnable, onDisable, pending }: {
  enabled: boolean
  onEnable: () => void
  onDisable: () => void
  pending: boolean
}) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 shrink-0">
      <button
        type="button"
        onClick={!enabled ? undefined : onDisable}
        disabled={pending}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${!enabled ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Single
      </button>
      <button
        type="button"
        onClick={enabled ? undefined : onEnable}
        disabled={pending}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${enabled ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Batch
      </button>
    </div>
  )
}

function ModeOption({ label, description, value, selected, onSelect }: {
  label: string
  description: string
  value: CursorMode
  selected: CursorMode
  onSelect: (v: CursorMode) => void
}) {
  const active = selected === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
        active
          ? 'border-foreground bg-foreground/5 text-foreground'
          : 'border-input-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="block mt-0.5 opacity-70">{description}</span>
    </button>
  )
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}
