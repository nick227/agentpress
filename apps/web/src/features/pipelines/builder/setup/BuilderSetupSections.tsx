import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertCircle, ArrowDown, ArrowUp, BookOpen, CheckCircle2, FileSpreadsheet, FileText, Image, Layers, Link2, Loader2, Package, Plus, Trash2, Upload, Workflow, XCircle } from 'lucide-react'
import { BUILTIN_AGENT_DEFINITIONS, appendAgentDefinitionToPipelineInputs, type AgentDefinition } from '@project/content'
import type { components } from '@project/sdk'
import { useDeletePipelineLoop, useDestinations, usePipelineBatches, useUpdateDestination, useUpdatePipeline, useUpsertPipelineLoop, useWordPressCategories } from '@project/sdk'
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
    <section className="space-y-2">
        <Label>Pipeline Name</Label>
      <Input
        value={nameInput}
        onChange={(event) => setNameInput(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
        className="font-medium text-base"
      />
    </section>
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
      <Label>Categories</Label>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading categories from {destination.name}…</p>
        : error ? <p className="text-xs text-destructive">Could not load categories. Check destination credentials.</p>
          : categories.length === 0 ? <p className="text-xs text-muted-foreground">No categories found.</p>
            : <CategoryPickers categories={categories} destination={destination} pipeline={pipeline} onDestinationChange={updateDestinationCategories} onPipelineChange={updatePipelineCategories} />}
    </section>
  )
}

function CategoryPickers({ categories, destination, onDestinationChange }: {
  categories: Array<{ id: number; name: string; count: number }>
  destination: Destination
  pipeline: Pipeline
  onDestinationChange: (ids: number[]) => void
  onPipelineChange: (ids: number[]) => void
}) {
  return (
    <>
      <CategoryPicker label="" categories={categories} selected={destination.defaultCategoryIds ?? []} onChange={onDestinationChange} />
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
      <Row label="Run mode">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={pipeline.dryRun} onChange={(event) => { onDryRunChange(event.target.checked); void save({ dryRun: event.target.checked }) }} className="rounded" />
          Dry run only
        </label>
      </Row>
      <Row label="Run title"><Input value={runTitle} onChange={(event) => onRunTitleChange(event.target.value)} placeholder={pipeline.name} className="h-8 text-sm" /></Row>
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
      <SectionHeader title="Variables">
        <Button variant="ghost" size="icon-sm" onClick={() => setShowPicker(true)} title="Import variable pack"><Package size={13} /></Button>
        <Button variant="outline" size="sm" loading={update.isPending} onClick={addVariable}><Plus size={13} /> Add variable</Button>
        <DatasetInput pipeline={pipeline} pipelineId={pipelineId} />
      </SectionHeader>
      {pipeline.variables.length === 0 ? <EmptyRow text="No variables configured." /> : <VariableList pipeline={pipeline} pipelineId={pipelineId} update={update} />}
      {showPicker && <VariablePackPicker pipeline={pipeline} pipelineId={pipelineId} onClose={() => setShowPicker(false)} />}
    </section>
  )
}

function DatasetInput({ pipeline, pipelineId }: { pipeline: Pipeline; pipelineId: string }) {
  const upsert = useUpsertPipelineLoop()
  const remove = useDeletePipelineLoop()
  const fileInput = useRef<HTMLInputElement>(null)
  const [showSheetInput, setShowSheetInput] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const dataset = pipeline.loop?.loopType === 'dataset' ? pipeline.loop.dataset : undefined
  const headers = dataset?.headers ?? []
  const conflicts = pipeline.variables.filter((variable) => headers.includes(variable.key) && variable.defaultValue !== undefined)
  const missing = pipeline.variables.filter((variable) => variable.required && variable.defaultValue === undefined && !headers.includes(variable.key))

  async function importCsv(file?: File) {
    if (!file) return
    try {
      await upsert.mutateAsync({
        pipelineId,
        loopType: 'dataset',
        cursorMode: 'all_stored',
        dataset: { sourceType: 'csv', name: file.name, csvText: await file.text() },
      })
      toast.success('CSV ready for batch runs')
    } catch (error: any) {
      toast.error(error.message ?? 'Could not import CSV')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function linkSheet() {
    if (!sheetUrl.trim()) return
    try {
      await upsert.mutateAsync({
        pipelineId,
        loopType: 'dataset',
        cursorMode: 'all_stored',
        dataset: { sourceType: 'google_sheets', url: sheetUrl.trim() },
      })
      toast.success('Google Sheet ready for batch runs')
      setSheetUrl('')
      setShowSheetInput(false)
    } catch (error: any) {
      toast.error(error.message ?? 'Could not link Google Sheet')
    }
  }

  async function removeDataset() {
    await remove.mutateAsync(pipelineId)
    toast.success('Batch data removed')
  }

  return (
    <div>
      <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { void importCsv(event.target.files?.[0]) }} />
      {dataset ? (
        <>
          <div className="flex items-start gap-2">
            <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{dataset.name}</p>
              <p className="text-xs text-muted-foreground">{dataset.rowCount} rows · {headers.length} columns · {dataset.sourceType === 'csv' ? 'CSV' : 'Google Sheets'}</p>
              <p className="mt-1 text-xs text-muted-foreground truncate">{headers.join(', ')}</p>
            </div>
            <Button variant="ghost" size="icon-sm" disabled={remove.isPending} onClick={() => { void removeDataset() }} aria-label="Remove batch data"><Trash2 size={13} /></Button>
          </div>
          {conflicts.length > 0 && <DatasetIssue>Remove the static value or rename the matching column: {conflicts.map((variable) => variable.key).join(', ')}</DatasetIssue>}
          {missing.length > 0 && <DatasetIssue>Missing required columns or static values: {missing.map((variable) => variable.key).join(', ')}</DatasetIssue>}
          {conflicts.length === 0 && missing.length === 0 && <p className="text-xs text-green-600">Mapped · row values will be validated before the batch starts.</p>}
          <p className="text-xs text-muted-foreground">Matching columns populate variables directly; every value is also available as <code className="font-mono">{'{row.column}'}</code>.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" loading={upsert.isPending} onClick={() => fileInput.current?.click()}><Upload size={13} /> Replace CSV</Button>
            <Button variant="outline" size="sm" onClick={() => setShowSheetInput(true)}><Link2 size={13} /> Replace with Sheet</Button>
          </div>
        </>
      ) : (
          <div className="page-header-actions">
            <Button variant="outline" size="sm" loading={upsert.isPending} onClick={() => fileInput.current?.click()}><Upload size={13} /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => setShowSheetInput(true)}><Link2 size={13} /> Sheet</Button>
          </div>
      )}
      {showSheetInput && (
        <SheetLinkModal
          value={sheetUrl}
          pending={upsert.isPending}
          onChange={setSheetUrl}
          onClose={() => setShowSheetInput(false)}
          onSubmit={linkSheet}
        />
      )}
    </div>
  )
}

function SheetLinkModal({ value, pending, onChange, onClose, onSubmit }: {
  value: string
  pending: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: () => Promise<void>
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, pending])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-link-title"
        aria-describedby="sheet-link-description"
        className="w-full max-w-sm rounded-lg border bg-surface shadow-xl"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!pending && value.trim()) void onSubmit()
          }}
        >
          <div className="space-y-1 border-b px-5 py-4">
            <h3 id="sheet-link-title" className="text-sm font-semibold">Link Google Sheet</h3>
            <p id="sheet-link-description" className="text-xs text-muted-foreground">
              Use a shareable link to import rows as batch data.
            </p>
          </div>
          <div className="p-5">
            <label htmlFor="sheet-link-url" className="mb-1.5 block text-xs font-medium">Google Sheets URL</label>
            <Input
              id="sheet-link-url"
              type="url"
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </div>
          <div className="flex justify-end gap-2 px-5 pb-4">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={pending} disabled={!value.trim()}>Link sheet</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DatasetIssue({ children }: { children: ReactNode }) {
  return <p className="flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"><AlertCircle size={13} className="mt-0.5 shrink-0" />{children}</p>
}

function VariableList({ pipeline, pipelineId, update }: { pipeline: Pipeline; pipelineId: string; update: ReturnType<typeof useUpdatePipeline> }) {
  const { onSelect } = usePipelineSelection()

  async function deleteVariable(id: string) {
    const variables = pipeline.variables
      .filter((v) => v.id !== id)
      .map((v) => ({ id: v.id, key: v.key, label: v.label, type: v.type as any, required: v.required, defaultValue: v.defaultValue, exampleValue: v.exampleValue, sortOrder: v.sortOrder }))
    await update.mutateAsync({ pipelineId, variables })
    toast.success('Variable deleted')
  }

  return (
    <div className="divide-y rounded border bg-surface">
      {pipeline.variables.map((variable) => (
        <div key={variable.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40">
          <button type="button" onClick={() => onSelect({ type: 'variable', id: variable.id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <p className="font-medium truncate">{`${variable.key}`}:</p>
              <p className="text-medium truncate">{`${variable.defaultValue}`}</p>
            </div>
            <span className="text-xs text-muted-foreground">{variable.type.replace('_', ' ')}</span>
            {variable.required && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Required</span>}
            <span className="text-muted-foreground">›</span>
          </button>
          <Button variant="ghost" size="icon-sm" disabled={update.isPending} onClick={() => { void deleteVariable(variable.id) }} aria-label={`Delete ${variable.key}`}><Trash2 size={13} /></Button>
        </div>
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

  async function saveAgents(agents: Pipeline['agents']) {
    await update.mutateAsync({
      pipelineId,
      agents: agents.map((agent, sortOrder) => ({
        id: agent.id,
        uid: agent.uid,
        kind: agent.kind,
        sourceAgentId: agent.sourceAgentId,
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

  async function moveAgent(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= pipeline.agents.length) return
    const agents = [...pipeline.agents]
    ;[agents[index], agents[target]] = [agents[target]!, agents[index]!]
    await saveAgents(agents)
  }

  async function toggleAgent(index: number) {
    const agents = pipeline.agents.map((agent, agentIndex) => agentIndex === index ? { ...agent, enabled: !agent.enabled } : agent)
    await saveAgents(agents)
  }

  async function deleteAgent(id: string) {
    await saveAgents(pipeline.agents.filter((agent) => agent.id !== id))
    toast.success('Agent deleted')
  }

  return (
    <section id="agents" className="space-y-3 scroll-mt-6">
      <AgentSectionHeader pending={update.isPending} onBrowse={() => setShowLibrary(true)} onAdd={addDefinition} />
      {pipeline.agents.length === 0 ? <EmptyRow text="No agents configured." /> : <AgentList pipeline={pipeline} pending={update.isPending} onMove={moveAgent} onToggle={toggleAgent} onDelete={deleteAgent} />}
      {showLibrary && <Suspense fallback={null}><AgentLibraryBrowser pipeline={pipeline} pipelineId={pipelineId} onClose={() => setShowLibrary(false)} onAgentAdded={(id) => onSelect({ type: 'agent', id })} /></Suspense>}
    </section>
  )
}

function AgentSectionHeader({ pending, onBrowse, onAdd }: { pending: boolean; onBrowse: () => void; onAdd: (definition: AgentDefinition) => void }) {
  const { onSelect } = usePipelineSelection()
  return (
    <SectionHeader title="Workflow">
      <Button variant="outline" size="sm" onClick={() => onSelect({ type: 'workflow-editor' })} title="Open full workflow editor"><Workflow size={13} /> Full Editor</Button>
      <Button variant="outline" size="sm" onClick={onBrowse} title="Browse agent library"><BookOpen size={13} /> Browse library</Button>
      <Button variant="outline" size="sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.blankImage)} title="Add image agent"><Image size={13} />Add image</Button>
      <Button variant="outline" size="sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.blankStatic)} title="Add static text Agent"><FileText size={13} /> Static text</Button>
      <Button variant="outline" size="sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.staticImage)} title="Add static image Agent"><Image size={13} /> Static image</Button>
      <Button variant="outline" size="sm" loading={pending} onClick={() => onAdd(BUILTIN_AGENT_DEFINITIONS.blankText)} title="Add AI agent"><Plus size={13} /> AI agent</Button>
    </SectionHeader>
  )
}

function AgentList({ pipeline, pending, onMove, onToggle, onDelete }: { pipeline: Pipeline; pending: boolean; onMove: (index: number, direction: -1 | 1) => void; onToggle: (index: number) => void; onDelete: (id: string) => void }) {
  const { onSelect } = usePipelineSelection()
  return (
    <div className="divide-y rounded border bg-surface">
      {pipeline.agents.map((agent, index) => (
        <div key={agent.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40">
          <input
            type="checkbox"
            checked={agent.enabled}
            disabled={pending}
            onChange={() => onToggle(index)}
            className="rounded shrink-0"
            aria-label={`${agent.enabled ? 'Disable' : 'Enable'} ${agent.name}`}
          />
          <button type="button" onClick={() => onSelect({ type: 'agent', id: agent.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{agent.name}</p><p className="text-xs text-muted-foreground truncate">{agentSublabel(agent)}</p></div>
            <span className={`text-[10px] font-medium ${agent.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>{agent.enabled ? 'Active' : 'Disabled'}</span>
          </button>
          <Button variant="ghost" size="icon-sm" disabled={index === 0 || pending} onClick={() => onMove(index, -1)} aria-label={`Move ${agent.name} up`}><ArrowUp size={13} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={index === pipeline.agents.length - 1 || pending} onClick={() => onMove(index, 1)} aria-label={`Move ${agent.name} down`}><ArrowDown size={13} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onDelete(agent.id)} aria-label={`Delete ${agent.name}`}><Trash2 size={13} /></Button>
        </div>
      ))}
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
      <SectionHeader title={batches.length > 0 ? 'Individual runs' : 'Runs'} />
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
  return <div className="section-header"><div className="min-w-0"><Label>{title}</Label>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>{children && <div className="flex flex-wrap items-center gap-1">{children}</div>}</div>
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
