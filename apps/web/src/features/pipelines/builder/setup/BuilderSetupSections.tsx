import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertCircle, ArrowDown, ArrowUp, BookOpen, CheckCircle2, FileText, Image, Layers, Loader2, Package, Plus, Type, XCircle } from 'lucide-react'
import { BUILTIN_AGENT_DEFINITIONS, appendAgentDefinitionToPipelineInputs, type AgentDefinition } from '@project/content'
import type { components } from '@project/sdk'
import { useDestinations, usePipelineBatches, useUpdateDestination, useUpdatePipeline, useWordPressCategories } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { VariablePackPicker } from '@/features/content/VariablePackPicker'
import { agentSublabel } from '@/features/pipelines/builder/agents/agentTypes'
import { usePipelineSelection } from '@/features/pipelines/builder/pipelineSelectionContext'

const AgentLibraryBrowser = lazy(() =>
  import('@/features/library/AgentLibraryBrowser').then((module) => ({ default: module.AgentLibraryBrowser })),
)

type Pipeline = components['schemas']['Pipeline']
type Run = components['schemas']['PipelineRun']
type Destination = components['schemas']['Destination']

interface ComposerRow {
  id: string
  type: 'agent_output'
  agentUid: string
  include: boolean
}

export function PipelineNameField({ pipeline, pipelineId, onRenamed }: {
  pipeline: Pipeline
  pipelineId: string
  onRenamed: (nextName: string, previousName: string) => void
}) {
  const update = useUpdatePipeline()
  const [nameInput, setNameInput] = useState(pipeline.name)
  useEffect(() => setNameInput(pipeline.name), [pipeline.id, pipeline.name])

  async function handleBlur() {
    if (!nameInput.trim() || nameInput === pipeline.name) return
    const nextName = nameInput.trim()
    onRenamed(nextName, pipeline.name)
    await update.mutateAsync({ pipelineId, name: nextName })
    toast.success('Pipeline renamed')
  }

  return (
    <div className="max-w-2xl">
      <Input
        value={nameInput}
        onChange={(event) => setNameInput(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
        className="font-medium text-base"
      />
    </div>
  )
}

export function DestinationSection({ pipeline, pipelineId }: { pipeline: Pipeline; pipelineId: string }) {
  const update = useUpdatePipeline()
  const { data, refetch } = useDestinations()
  const destinations = data?.data ?? []
  const activeDestination = destinations.find((destination) => destination.id === pipeline.destinationId)

  async function selectDestination(destinationId: string | null) {
    await update.mutateAsync({ pipelineId, destinationId })
    toast.success('Saved')
  }

  return (
    <>
      <section className="space-y-2">
        <Label>Destination</Label>
        <DestinationPicker destinations={destinations} activeDestination={activeDestination} onChange={selectDestination} />
        <Link to="/destinations/new" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus size={12} /> Add WordPress destination
        </Link>
      </section>
      {activeDestination && (
        <WordPressCategoriesSection
          pipeline={pipeline}
          pipelineId={pipelineId}
          destination={activeDestination}
          onDestinationUpdated={() => { void refetch() }}
        />
      )}
    </>
  )
}

function DestinationPicker({ destinations, activeDestination, onChange }: {
  destinations: Destination[]
  activeDestination?: Destination
  onChange: (destinationId: string | null) => void
}) {
  if (destinations.length === 0) {
    return <p className="text-xs text-muted-foreground">No destinations yet. Add one to publish live runs.</p>
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={activeDestination?.id ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 min-w-0 flex-1 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">No destination selected</option>
        {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
      </select>
      {activeDestination && <Link to={`/destinations/${activeDestination.id}`} className="inline-flex h-9 items-center rounded border px-3 text-xs font-medium hover:bg-muted">Edit</Link>}
    </div>
  )
}

function WordPressCategoriesSection({ pipeline, pipelineId, destination, onDestinationUpdated }: {
  pipeline: Pipeline
  pipelineId: string
  destination: Destination
  onDestinationUpdated: () => void
}) {
  const update = useUpdatePipeline()
  const updateDestination = useUpdateDestination()
  const { data, isLoading, error } = useWordPressCategories(destination.id)
  const categories = data?.data ?? []

  async function updateDestinationCategories(ids: number[]) {
    await updateDestination.mutateAsync({ destinationId: destination.id, defaultCategoryIds: ids.length ? ids : null })
    onDestinationUpdated()
    toast.success('Destination categories saved')
  }

  async function updatePipelineCategories(ids: number[]) {
    await update.mutateAsync({ pipelineId, wpCategoryIds: ids.length ? ids : null })
    toast.success('Pipeline categories saved')
  }

  return (
    <section className="space-y-3">
      <Label>WordPress categories</Label>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading categories from {destination.name}…</p>
        : error ? <p className="text-xs text-destructive">Could not load WordPress categories. Check destination credentials.</p>
          : categories.length === 0 ? <p className="text-xs text-muted-foreground">No categories found on this WordPress site.</p>
            : <CategoryPickers categories={categories} destination={destination} pipeline={pipeline} onDestinationChange={updateDestinationCategories} onPipelineChange={updatePipelineCategories} />}
    </section>
  )
}

function CategoryPickers({ categories, destination, pipeline, onDestinationChange, onPipelineChange }: {
  categories: Array<{ id: number; name: string; count: number }>
  destination: Destination
  pipeline: Pipeline
  onDestinationChange: (ids: number[]) => void
  onPipelineChange: (ids: number[]) => void
}) {
  return (
    <>
      <CategoryPicker label="Destination defaults" hint="Used when this pipeline has no category override." categories={categories} selected={destination.defaultCategoryIds ?? []} onChange={onDestinationChange} />
      <CategoryPicker label="Pipeline override" hint="Optional. Overrides destination defaults for this pipeline only." categories={categories} selected={pipeline.wpCategoryIds ?? []} onChange={onPipelineChange} />
    </>
  )
}

export function PipelineSettingsSection({ pipeline, pipelineId, runTitle, onRunTitleChange, onDryRunChange }: {
  pipeline: Pipeline
  pipelineId: string
  runTitle: string
  onRunTitleChange: (title: string) => void
  onDryRunChange: (dryRun: boolean) => void
}) {
  const update = useUpdatePipeline()
  async function save(fields: Partial<Pipeline>) {
    await update.mutateAsync({ pipelineId, ...fields })
    toast.success('Saved')
  }
  return (
    <section className="space-y-3">
      <Label>Settings</Label>
      <Row label="Current run title"><Input value={runTitle} onChange={(event) => onRunTitleChange(event.target.value)} placeholder={pipeline.name} className="h-8 text-sm" /></Row>
      <Row label="Run mode">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={pipeline.dryRun} onChange={(event) => { onDryRunChange(event.target.checked); void save({ dryRun: event.target.checked }) }} className="rounded" />
          Dry run only
        </label>
      </Row>
      <Row label="Status">
        <div className="flex gap-1.5 flex-wrap">
          {(['draft', 'active', 'paused', 'archived'] as const).map((status) => <Chip key={status} active={pipeline.status === status} onClick={() => save({ status })}>{status.charAt(0).toUpperCase() + status.slice(1)}</Chip>)}
        </div>
      </Row>
    </section>
  )
}

export function VariablesSection({ pipeline, pipelineId }: { pipeline: Pipeline; pipelineId: string }) {
  const { onSelect } = usePipelineSelection()
  const update = useUpdatePipeline()
  const [showPicker, setShowPicker] = useState(false)

  async function addVariable() {
    const variables = pipeline.variables.map((variable) => ({
      id: variable.id,
      key: variable.key,
      label: variable.label,
      type: variable.type as any,
      required: variable.required,
      defaultValue: variable.defaultValue,
      exampleValue: variable.exampleValue,
      sortOrder: variable.sortOrder,
    }))
    const result = await update.mutateAsync({
      pipelineId,
      variables: [...variables, { key: `var_${variables.length + 1}`, label: '', type: 'text', required: false, sortOrder: variables.length }],
    })
    const added = result.data.variables.at(-1)
    if (added) onSelect({ type: 'variable', id: added.id })
  }

  return (
    <section id="variables" className="space-y-3 scroll-mt-6">
      <SectionHeader title="Variables" description="Runtime inputs available to agent prompts.">
        <Button variant="ghost" size="icon-sm" onClick={() => setShowPicker(true)} title="Import variable pack"><Package size={13} /></Button>
        <Button variant="outline" size="sm" loading={update.isPending} onClick={addVariable}><Plus size={13} /> Add variable</Button>
      </SectionHeader>
      {pipeline.variables.length === 0 ? <EmptyRow text="No variables configured." /> : <VariableList pipeline={pipeline} />}
      {showPicker && <VariablePackPicker pipeline={pipeline} pipelineId={pipelineId} onClose={() => setShowPicker(false)} />}
    </section>
  )
}

function VariableList({ pipeline }: { pipeline: Pipeline }) {
  const { onSelect } = usePipelineSelection()
  return (
    <div className="divide-y rounded border bg-surface">
      {pipeline.variables.map((variable) => (
        <button key={variable.id} type="button" onClick={() => onSelect({ type: 'variable', id: variable.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{variable.label || variable.key}</p><p className="text-xs text-muted-foreground font-mono truncate">{`{${variable.key}}`}</p></div>
          <span className="text-xs text-muted-foreground">{variable.type.replace('_', ' ')}</span>
          {variable.required && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Required</span>}
          <span className="text-muted-foreground">›</span>
        </button>
      ))}
    </div>
  )
}

export function AgentsSection({ pipeline, pipelineId }: { pipeline: Pipeline; pipelineId: string }) {
  const { onSelect } = usePipelineSelection()
  const update = useUpdatePipeline()
  const [showLibrary, setShowLibrary] = useState(false)

  async function addDefinition(definition: AgentDefinition) {
    const result = await update.mutateAsync({ pipelineId, agents: appendAgentDefinitionToPipelineInputs(pipeline.agents, definition) })
    const added = result.data.agents.at(-1)
    if (added) onSelect({ type: 'agent', id: added.id })
  }

  async function moveAgent(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= pipeline.agents.length) return
    const agents = [...pipeline.agents]
    ;[agents[index], agents[target]] = [agents[target]!, agents[index]!]
    await update.mutateAsync({
      pipelineId,
      agents: agents.map((agent, sortOrder) => ({
        id: agent.id,
        uid: agent.uid,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        userPrompt: agent.userPrompt,
        outputTarget: agent.outputTarget,
        outputFormat: agent.outputFormat,
        imageMode: agent.imageMode,
        selectedImageAssetId: agent.selectedImageAssetId,
        enabled: agent.enabled,
        sortOrder,
      })),
    })
  }

  return (
    <section id="agents" className="space-y-3 scroll-mt-6">
      <AgentSectionHeader pending={update.isPending} onBrowse={() => setShowLibrary(true)} onAdd={addDefinition} />
      {pipeline.agents.length === 0 ? <EmptyRow text="No agents configured." /> : <AgentList pipeline={pipeline} pending={update.isPending} onMove={moveAgent} />}
      {showLibrary && <Suspense fallback={null}><AgentLibraryBrowser pipeline={pipeline} pipelineId={pipelineId} onClose={() => setShowLibrary(false)} onAgentAdded={(id) => onSelect({ type: 'agent', id })} /></Suspense>}
    </section>
  )
}

function AgentSectionHeader({ pending, onBrowse, onAdd }: { pending: boolean; onBrowse: () => void; onAdd: (definition: AgentDefinition) => void }) {
  return (
    <SectionHeader title="Agents" description="Ordered steps executed by this pipeline.">
      <Button variant="ghost" size="icon-sm" onClick={onBrowse} title="Browse agent library"><BookOpen size={13} /></Button>
      <Button variant="ghost" size="icon-sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.blankImage)} title="Add image agent"><Image size={13} /></Button>
      <Button variant="ghost" size="icon-sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.staticImage)} title="Add static agent"><FileText size={13} /></Button>
      <Button variant="outline" size="sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.blankText)}><Plus size={13} /> Add agent</Button>
    </SectionHeader>
  )
}

function AgentList({ pipeline, pending, onMove }: { pipeline: Pipeline; pending: boolean; onMove: (index: number, direction: -1 | 1) => void }) {
  const { onSelect } = usePipelineSelection()
  return (
    <div className="divide-y rounded border bg-surface">
      {pipeline.agents.map((agent, index) => (
        <div key={agent.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40">
          <button type="button" onClick={() => onSelect({ type: 'agent', id: agent.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{agent.name}</p><p className="text-xs text-muted-foreground truncate">{agentSublabel(agent)}</p></div>
            <span className={`text-[10px] font-medium ${agent.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>{agent.enabled ? 'Active' : 'Disabled'}</span>
          </button>
          <Button variant="ghost" size="icon-sm" disabled={index === 0 || pending} onClick={() => onMove(index, -1)} aria-label={`Move ${agent.name} up`}><ArrowUp size={13} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={index === pipeline.agents.length - 1 || pending} onClick={() => onMove(index, 1)} aria-label={`Move ${agent.name} down`}><ArrowDown size={13} /></Button>
          <span className="text-muted-foreground">›</span>
        </div>
      ))}
    </div>
  )
}

export function BodyComposerSection({ pipeline, pipelineId }: { pipeline: Pipeline; pipelineId: string }) {
  const update = useUpdatePipeline()
  const rows = getComposerRows(pipeline)
  function save(nextRows: ComposerRow[]) { void update.mutateAsync({ pipelineId, bodyComposer: nextRows.map((row) => ({ ...row })) }) }
  function move(index: number, direction: -1 | 1) {
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [row] = next.splice(index, 1)
    if (!row) return
    next.splice(target, 0, row)
    save(next)
  }
  function toggle(row: ComposerRow) { save(rows.map((item) => item.id === row.id ? { ...item, include: !item.include } : item)) }

  return (
    <section className="space-y-3 mt-8">
      <SectionHeader title="Body Composer" description="Arrange existing text and image outputs. Reordering or excluding rows does not run AI." />
      {rows.length === 0 ? <EmptyRow text="Add body or inline image agents to compose the final document body." /> : <ComposerRows pipeline={pipeline} rows={rows} onMove={move} onToggle={toggle} />}
    </section>
  )
}

function ComposerRows({ pipeline, rows, onMove, onToggle }: { pipeline: Pipeline; rows: ComposerRow[]; onMove: (index: number, direction: -1 | 1) => void; onToggle: (row: ComposerRow) => void }) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const agent = pipeline.agents.find((item) => item.uid === row.agentUid)
        if (!agent) return null
        return (
          <div key={row.id} className={`border rounded px-3 py-2 flex items-center gap-3 transition-colors ${row.include ? 'bg-surface' : 'bg-muted/30 opacity-60'}`}>
            <input type="checkbox" checked={row.include} onChange={() => onToggle(row)} className="rounded shrink-0" aria-label={`Include ${agent.name} in final body`} />
            <span className="text-muted-foreground shrink-0">{agent.outputTarget === 'image' ? <Image size={14} /> : <Type size={14} />}</span>
            <div className="text-left min-w-0 flex-1"><span className="block text-sm font-medium truncate">{agent.name}</span><span className="block text-xs text-muted-foreground font-mono truncate">{row.include ? 'Included' : 'Excluded'} · {agent.uid}</span></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, -1)} disabled={index === 0}><ArrowUp size={13} /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, 1)} disabled={index === rows.length - 1}><ArrowDown size={13} /></Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RunsSection({ pipeline, runs }: { pipeline: Pipeline; runs: Run[] }) {
  const { onSelect } = usePipelineSelection()
  const { data: batchesData } = usePipelineBatches(pipeline.id)
  const batches = batchesData?.data ?? []

  return (
    <section id="runs" className="space-y-3 mt-8 scroll-mt-6">
      {batches.length > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Batch runs" description="Each batch creates one run per research item." />
          <div className="divide-y rounded border bg-surface">
            {batches.map((batch) => <BatchRow key={batch.id} batch={batch} />)}
          </div>
        </div>
      )}
      <SectionHeader title={batches.length > 0 ? 'Individual runs' : 'Runs'} description="Newest pipeline executions first." />
      {runs.length === 0 ? <EmptyRow text="No runs yet." /> : (
        <div className="divide-y rounded border bg-surface">
          {runs.map((run) => <RunRow key={run.id} run={run} fallbackTitle={pipeline.name} onClick={() => onSelect({ type: 'run', id: run.id })} />)}
        </div>
      )}
    </section>
  )
}

type PipelineRunBatch = components['schemas']['PipelineRunBatch']

function BatchRow({ batch }: { batch: PipelineRunBatch }) {
  const isActive = batch.status === 'running' || batch.status === 'queued'
  const pct = batch.totalCount > 0 ? Math.round((batch.completedCount / batch.totalCount) * 100) : 0

  return (
    <div className="px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Layers size={12} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">
          {batch.sourceName ?? 'Batch'} · {batch.totalCount} items
        </span>
        <BatchStatusBadge status={batch.status} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {batch.completedCount}/{batch.totalCount}
          {batch.failedCount > 0 && ` · ${batch.failedCount} failed`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{new Date(batch.createdAt).toLocaleString()}</p>
    </div>
  )
}

function BatchStatusBadge({ status }: { status: string }) {
  if (status === 'running') return <span className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded"><Loader2 size={10} className="animate-spin" />Running</span>
  if (status === 'completed') return <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded"><CheckCircle2 size={10} />Done</span>
  if (status === 'completed_with_failures') return <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"><AlertCircle size={10} />Partial</span>
  if (status === 'failed') return <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 px-1.5 py-0.5 rounded"><XCircle size={10} />Failed</span>
  return <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{status}</span>
}

function RunRow({ run, fallbackTitle, onClick }: { run: Run; fallbackTitle: string; onClick: () => void }) {
  const statusClass = run.status === 'failed' ? 'bg-red-100 text-red-700' : run.status === 'running' || run.status === 'queued' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{run.title || fallbackTitle}</p><p className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</p></div>
      <span className="text-xs text-muted-foreground">{run.dryRun ? 'Dry' : 'Live'}</span>
      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>{run.status}</span>
      <span className="text-muted-foreground">›</span>
    </button>
  )
}

function SectionHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="flex items-end justify-between gap-3"><div><Label>{title}</Label>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>{children && <div className="flex items-center gap-1">{children}</div>}</div>
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded border bg-surface px-3 py-4 text-sm text-muted-foreground">{text}</div>
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</p>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start gap-3"><span className="text-xs text-muted-foreground w-20 shrink-0 pt-1.5">{label}</span><div className="flex-1">{children}</div></div>
}

function Chip({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${active ? 'bg-foreground text-background border-foreground' : 'border-input-border hover:bg-muted'}`}>{children}</button>
}

function CategoryPicker({ label, hint, categories, selected, onChange }: {
  label: string
  hint?: string
  categories: Array<{ id: number; name: string; count: number }>
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  function toggle(id: number) { onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]) }
  return (
    <div className="space-y-1.5">
      <div><p className="text-xs font-medium text-foreground">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="flex flex-wrap gap-1.5">{categories.map((category) => <Chip key={category.id} active={selected.includes(category.id)} onClick={() => toggle(category.id)}>{category.name}{category.count > 0 ? ` (${category.count})` : ''}</Chip>)}</div>
    </div>
  )
}

function getComposerRows(pipeline: Pipeline): ComposerRow[] {
  const eligibleAgents = pipeline.agents.filter((agent) => agent.outputTarget === 'body' || agent.outputTarget === 'image')
  const existingRows = Array.isArray(pipeline.bodyComposer) ? pipeline.bodyComposer as unknown as ComposerRow[] : []
  const rows = existingRows
    .filter((row) => eligibleAgents.some((agent) => agent.uid === row.agentUid))
    .map((row) => ({ ...row, type: 'agent_output' as const, include: row.include !== false }))
  for (const agent of eligibleAgents) {
    if (!rows.some((row) => row.agentUid === agent.uid)) rows.push({ id: agent.uid, type: 'agent_output', agentUid: agent.uid, include: true })
  }
  return rows
}
