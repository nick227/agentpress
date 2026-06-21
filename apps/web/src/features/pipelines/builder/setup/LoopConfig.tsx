import { useState, useEffect } from 'react'
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

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/20 border-b flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Run mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEnabled ? 'Batch — creates one run per research item' : 'Single run per trigger'}
          </p>
        </div>
        <ModeToggle enabled={isEnabled} onEnable={handleEnable} onDisable={handleDisable} pending={upsert.isPending || remove.isPending} />
      </div>

      {isEnabled && (
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Research source</label>
            <select
              value={sourceId}
              onChange={(e) => { setSourceId(e.target.value); setDirty(true) }}
              className="w-full h-8 rounded border border-input-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {loop?.sourceName && !dirty && (
              <p className="text-xs text-muted-foreground">Currently: {loop.sourceName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Item selection</label>
            <div className="space-y-1">
              <ModeOption
                label="All stored items"
                description="Re-run for every item in the source"
                value="all_stored"
                selected={cursorMode}
                onSelect={(v) => { setCursorMode(v); setDirty(true) }}
              />
              <ModeOption
                label="New items only"
                description="Only items added since last batch run"
                value="new_since_cursor"
                selected={cursorMode}
                onSelect={(v) => { setCursorMode(v); setDirty(true) }}
              />
              <ModeOption
                label="Date range"
                description="Pick a specific date range for backfills"
                value="date_range"
                selected={cursorMode}
                onSelect={(v) => { setCursorMode(v); setDirty(true) }}
              />
            </div>
          </div>

          {cursorMode === 'date_range' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => { setDateRangeStart(e.target.value); setDirty(true) }}
                  className="w-full h-8 rounded border border-input-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => { setDateRangeEnd(e.target.value); setDirty(true) }}
                  className="w-full h-8 rounded border border-input-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {cursorMode === 'new_since_cursor' && loop?.cursorAt && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2.5 py-1.5 border">
              Last batch cursor: {new Date(loop.cursorAt).toLocaleString()}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Max batch size <span className="text-muted-foreground font-normal">(safety cap)</span>
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxBatchSize}
              onChange={(e) => { setMaxBatchSize(Number(e.target.value)); setDirty(true) }}
              className="w-24 h-8 rounded border border-input-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {dirty && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" loading={upsert.isPending} onClick={handleSave}>Save batch config</Button>
              <Button size="sm" variant="outline" onClick={() => {
                setSourceId(loop?.sourceId ?? '')
                setCursorMode((loop?.cursorMode as CursorMode) ?? 'all_stored')
                setDirty(false)
              }}>Discard</Button>
            </div>
          )}
        </div>
      )}
    </div>
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
