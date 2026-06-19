import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Image, Play, Plus, Trash2, Type, Globe, ChevronDown, Zap } from 'lucide-react'
import type { components } from '@project/sdk'
import {
  useUpdatePipeline,
  useStartPipelineRun,
  useDestinations,
  useCreateDestination,
  useUpdateDestination,
  useDeleteDestination,
  useWordPressCategories,
} from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Pipeline = components['schemas']['Pipeline']
interface ComposerRow {
  id: string
  type: 'agent_output'
  agentUid: string
  include: boolean
}

interface Props {
  pipeline: Pipeline
  pipelineId: string
  onRunCreated: (runId: string) => void
}

export function BuilderSetup({ pipeline, pipelineId, onRunCreated }: Props) {
  const update = useUpdatePipeline()
  const startRun = useStartPipelineRun()
  const { data: destinationsData, refetch: refetchDestinations } = useDestinations(pipeline.accountId)
  const createDestination = useCreateDestination()
  const updateDestination = useUpdateDestination()
  const deleteDestination = useDeleteDestination()
  const destinations = destinationsData?.data ?? []

  const [nameInput, setNameInput] = useState(pipeline.name)
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [showAddDestination, setShowAddDestination] = useState(false)
  const [runTitle, setRunTitle] = useState(pipeline.name)
  const previousPipelineId = useRef(pipeline.id)
  const previousPipelineName = useRef(pipeline.name)
  const [forceRegenerate, setForceRegenerate] = useState(false)
  const [forceRegenerateAgentUids, setForceRegenerateAgentUids] = useState<string[]>([])
  const [dryRun, setDryRun] = useState(pipeline.dryRun)
  const [runVars, setRunVars] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const v of pipeline.variables) {
      defaults[v.key] = String(v.defaultValue ?? v.exampleValue ?? '')
    }
    return defaults
  })
  const [destForm, setDestForm] = useState({
    name: '',
    siteUrl: '',
    username: '',
    secret: '',
    defaultStatus: 'draft' as 'draft' | 'publish',
  })

  useEffect(() => {
    setDryRun(pipeline.dryRun)
  }, [pipeline.dryRun])

  useEffect(() => {
    const switchedPipeline = previousPipelineId.current !== pipeline.id
    const previousName = previousPipelineName.current

    setNameInput(pipeline.name)
    setRunTitle((current) => {
      if (switchedPipeline || !current.trim() || current === previousName) {
        return pipeline.name
      }
      return current
    })

    previousPipelineId.current = pipeline.id
    previousPipelineName.current = pipeline.name
  }, [pipeline.id, pipeline.name])

  async function handleSave(fields: Partial<typeof pipeline>) {
    await update.mutateAsync({ pipelineId, ...fields })
    toast.success('Saved')
  }

  async function handleNameBlur() {
    if (nameInput.trim() && nameInput !== pipeline.name) {
      const nextName = nameInput.trim()
      if (!runTitle.trim() || runTitle === pipeline.name) {
        setRunTitle(nextName)
      }
      await update.mutateAsync({ pipelineId, name: nextName })
      toast.success('Pipeline renamed')
    }
  }

  async function handleRun() {
    const result = await startRun.mutateAsync({
      pipelineId,
      variables: runVars,
      dryRun,
      title: runTitle.trim() || pipeline.name,
      forceRegenerate,
      forceRegenerateAgentUids: forceRegenerate ? undefined : forceRegenerateAgentUids,
    })
    toast.success(dryRun ? 'Dry run started' : 'Live run started')
    setShowRunDialog(false)
    setForceRegenerate(false)
    setForceRegenerateAgentUids([])
    onRunCreated(result.data.id)
  }

  function toggleForceAgent(uid: string) {
    setForceRegenerateAgentUids((current) => (
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    ))
  }

  async function handleAddDestination() {
    const nextDestination = {
      name: destForm.name.trim(),
      siteUrl: destForm.siteUrl.trim(),
      username: destForm.username.trim(),
      secret: destForm.secret.trim(),
      defaultStatus: destForm.defaultStatus,
    }

    if (!nextDestination.name || !nextDestination.siteUrl || !nextDestination.username || !nextDestination.secret) {
      toast.error('Name, Site URL, WordPress username and Application Password are required')
      return
    }
    const created = await createDestination.mutateAsync({
      accountId: pipeline.accountId,
      ...nextDestination,
    })
    await update.mutateAsync({ pipelineId, destinationId: created.data.id })
    await refetchDestinations()
    toast.success('Destination added and selected')
    setDestForm({ name: '', siteUrl: '', username: '', secret: '', defaultStatus: 'draft' })
    setShowAddDestination(false)
  }

  async function handleDeleteDestination(destinationId: string) {
    await deleteDestination.mutateAsync({ destinationId, accountId: pipeline.accountId })
    toast.success('Destination removed')
    if (pipeline.destinationId === destinationId) {
      await handleSave({ destinationId: null })
    }
    refetchDestinations()
  }

  const activeDestination = destinations.find((d) => d.id === pipeline.destinationId)
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useWordPressCategories(activeDestination?.id)
  const wordpressCategories = categoriesData?.data ?? []
  const pipelineCategoryIds = pipeline.wpCategoryIds ?? []
  const composerRows = getComposerRows(pipeline)

  async function saveComposer(nextRows: ComposerRow[]) {
    await update.mutateAsync({ pipelineId, bodyComposer: nextRows.map((row) => ({ ...row })) })
  }

  function moveComposerRow(index: number, direction: -1 | 1) {
    const next = [...composerRows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [row] = next.splice(index, 1)
    if (!row) return
    next.splice(target, 0, row)
    saveComposer(next)
  }

  function toggleComposerRow(row: ComposerRow) {
    saveComposer(composerRows.map((item) => item.id === row.id ? { ...item, include: !item.include } : item))
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="p-6">
        <div className="max-w-6xl space-y-6">
          <div className="max-w-2xl">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="font-medium text-base"
            />
          </div>

          <div className="gap-6">
            <div className="space-y-6">

              <section className="space-y-2">
                <Label>Destination</Label>
                {destinations.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={pipeline.destinationId ?? ''}
                      onChange={(e) => handleSave({ destinationId: e.target.value || null })}
                      className="h-9 min-w-0 flex-1 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">No destination selected</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {activeDestination && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteDestination(activeDestination.id)}
                        loading={deleteDestination.isPending}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                ) : (
                  !showAddDestination && (
                    <p className="text-xs text-muted-foreground">
                      No destinations yet. Add one to publish live runs.
                    </p>
                  )
                )}

                {showAddDestination ? (
                  <div className="border rounded p-4 space-y-3 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">WordPress REST API</p>
                    <div className="space-y-2">
                      <Input
                        placeholder="Name (e.g. My Blog)"
                        value={destForm.name}
                        onChange={(e) => setDestForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <Input
                        placeholder="Site URL (e.g. https://myblog.com)"
                        value={destForm.siteUrl}
                        onChange={(e) => setDestForm((f) => ({ ...f, siteUrl: e.target.value }))}
                      />
                      <Input
                        placeholder="WordPress username"
                        value={destForm.username}
                        onChange={(e) => setDestForm((f) => ({ ...f, username: e.target.value }))}
                      />
                      <Input
                        type="password"
                        placeholder="Application Password"
                        value={destForm.secret}
                        onChange={(e) => setDestForm((f) => ({ ...f, secret: e.target.value }))}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        {(['draft', 'publish'] as const).map((s) => (
                          <label
                            key={s}
                            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none"
                          >
                            <input
                              type="radio"
                              name="destination-default-status"
                              value={s}
                              checked={destForm.defaultStatus === s}
                              onChange={() => setDestForm((f) => ({ ...f, defaultStatus: s }))}
                            />
                            {s === 'draft' ? 'Draft' : 'Live'}
                          </label>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setShowAddDestination(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" loading={createDestination.isPending} onClick={handleAddDestination}>
                          Add destination
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddDestination(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus size={12} />
                    Add WordPress destination
                  </button>
                )}
              </section>

              {activeDestination && (
                <section className="space-y-3">
                  <Label>WordPress categories</Label>
                  {categoriesLoading ? (
                    <p className="text-xs text-muted-foreground">Loading categories from {activeDestination.name}…</p>
                  ) : categoriesError ? (
                    <p className="text-xs text-destructive">Could not load WordPress categories. Check destination credentials.</p>
                  ) : wordpressCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories found on this WordPress site.</p>
                  ) : (
                    <>
                      <CategoryPicker
                        label="Destination defaults"
                        hint="Used when this pipeline has no category override."
                        categories={wordpressCategories}
                        selected={activeDestination.defaultCategoryIds ?? []}
                        onChange={async (ids) => {
                          await updateDestination.mutateAsync({
                            destinationId: activeDestination.id,
                            accountId: pipeline.accountId,
                            defaultCategoryIds: ids.length > 0 ? ids : null,
                          })
                          refetchDestinations()
                          toast.success('Destination categories saved')
                        }}
                      />
                      <CategoryPicker
                        label="Pipeline override"
                        hint="Optional. Overrides destination defaults for this pipeline only."
                        categories={wordpressCategories}
                        selected={pipelineCategoryIds}
                        onChange={async (ids) => {
                          await update.mutateAsync({
                            pipelineId,
                            wpCategoryIds: ids.length > 0 ? ids : null,
                          })
                          toast.success('Pipeline categories saved')
                        }}
                      />
                    </>
                  )}
                </section>
              )}

              {/* Run mode + Schedule — collapsed into a compact row group */}
              <section className="space-y-3">
                <Label>Settings</Label>

                <Row label="Current run title">
                  <Input
                    value={runTitle}
                    onChange={(e) => setRunTitle(e.target.value)}
                    placeholder={pipeline.name}
                    className="h-8 text-sm"
                  />
                </Row>

                <Row label="Run mode">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pipeline.dryRun}
                      onChange={(e) => {
                        setDryRun(e.target.checked)
                        void handleSave({ dryRun: e.target.checked })
                      }}
                      className="rounded"
                    />
                    Dry run only
                  </label>
                </Row>

                <Row label="Schedule">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {(['manual', 'recurring'] as const).map((mode) => (
                      <Chip
                        key={mode}
                        active={pipeline.scheduleMode === mode}
                        onClick={() => handleSave({ scheduleMode: mode })}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Chip>
                    ))}
                    {pipeline.scheduleMode === 'recurring' && (
                      <>
                        <ChevronDown size={11} className="text-muted-foreground" />
                        {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                          <Chip
                            key={freq}
                            active={pipeline.frequency === freq}
                            accent
                            onClick={() => handleSave({ frequency: freq })}
                          >
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </Chip>
                        ))}
                        <Input
                          type="time"
                          value={pipeline.timeOfDay ?? ''}
                          onChange={(e) => handleSave({ timeOfDay: e.target.value })}
                          className="w-28 h-7 text-xs"
                        />
                      </>
                    )}
                  </div>
                </Row>

                <Row label="Status">
                  <div className="flex gap-1.5 flex-wrap">
                    {(['draft', 'active', 'paused', 'archived'] as const).map((s) => (
                      <Chip
                        key={s}
                        active={pipeline.status === s}
                        onClick={() => handleSave({ status: s })}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Chip>
                    ))}
                  </div>
                </Row>
              </section>
            </div>

            <section className="space-y-3 mt-8">
              <div>
                <Label>Body Composer</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Arrange existing text and image outputs. Reordering or excluding rows does not run AI.
                </p>
              </div>

              {composerRows.length === 0 ? (
                <div className="border rounded p-4 text-sm text-muted-foreground bg-surface">
                  Add body or inline image agents to compose the final document body.
                </div>
              ) : (
                <div className="space-y-2">
                  {composerRows.map((row, index) => {
                    const agent = pipeline.agents.find((item) => item.uid === row.agentUid)
                    if (!agent) return null
                    const isImage = agent.outputTarget === 'image'
                    return (
                      <div key={row.id} className={`border rounded px-3 py-2 flex items-center gap-3 transition-colors ${row.include ? 'bg-surface' : 'bg-muted/30 opacity-60'}`}>
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={() => toggleComposerRow(row)}
                          className="rounded shrink-0"
                          aria-label={`Include ${agent.name} in final body`}
                        />
                        <span className="text-muted-foreground shrink-0">
                          {isImage ? <Image size={14} /> : <Type size={14} />}
                        </span>
                        <div className="text-left min-w-0 flex-1">
                          <span className="block text-sm font-medium truncate">{agent.name}</span>
                          <span className="block text-xs text-muted-foreground font-mono truncate">
                            {row.include ? 'Included' : 'Excluded'} · {agent.uid}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => moveComposerRow(index, -1)} disabled={index === 0}>
                            <ArrowUp size={13} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => moveComposerRow(index, 1)} disabled={index === composerRows.length - 1}>
                            <ArrowDown size={13} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3">
        <div className="max-w-6xl flex items-center justify-end gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{pipeline.dryRun ? 'Dry run mode' : 'Live run mode'}
            </p>
          </div>
          <Button onClick={() => setShowRunDialog(true)} size="sm" className="gap-1.5 shrink-0">
            <Play size={13} />
            Run
          </Button>
        </div>
      </div>

      {/* Run dialog */}
      {showRunDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg border w-full max-w-sm shadow-lg">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Run Pipeline</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowRunDialog(false)}>×</Button>
            </div>
            <div className="p-5 space-y-4">
              {activeDestination && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-2.5 py-2 border">
                  <Globe size={12} />
                  <span className="font-medium text-foreground">{activeDestination.name}</span>
                  <span className="truncate">{activeDestination.siteUrl}</span>
                </div>
              )}
              {pipeline.variables.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Variable values</p>
                  {pipeline.variables.map((v) => (
                    <div key={v.key} className="space-y-1">
                      <label className="text-xs font-medium text-foreground">
                        {v.label || v.key}
                        {v.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>
                      <Input
                        value={runVars[v.key] ?? ''}
                        onChange={(e) => setRunVars((r) => ({ ...r, [v.key]: e.target.value }))}
                        placeholder={String(v.exampleValue ?? v.defaultValue ?? '')}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No variables required.</p>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Dry run (preview only, don't publish)
              </label>

              <div className="border rounded p-3 bg-muted/20 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forceRegenerate}
                    onChange={(e) => setForceRegenerate(e.target.checked)}
                  />
                  Force regenerate all outputs
                </label>
                {!forceRegenerate && pipeline.agents.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Force selected agents</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pipeline.agents.map((agent) => {
                        const active = forceRegenerateAgentUids.includes(agent.uid)
                        return (
                          <button
                            key={agent.uid}
                            type="button"
                            onClick={() => toggleForceAgent(agent.uid)}
                            className={`px-2 py-1 rounded border text-xs transition-colors ${active ? 'bg-foreground text-background border-foreground' : 'border-input-border hover:bg-muted'
                              }`}
                          >
                            {agent.uid}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-4 flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowRunDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={startRun.isPending} onClick={handleRun} className="gap-1.5">
                <Zap size={13} />
                {dryRun ? 'Run dry' : 'Run live'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</p>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0 pt-1.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Chip({
  children,
  active,
  accent,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${active
          ? accent
            ? 'bg-accent text-accent-foreground border-accent'
            : 'bg-foreground text-background border-foreground'
          : 'border-input-border hover:bg-muted'
        }`}
    >
      {children}
    </button>
  )
}

function CategoryPicker({
  label,
  hint,
  categories,
  selected,
  onChange,
}: {
  label: string
  hint?: string
  categories: Array<{ id: number; name: string; count: number }>
  selected: number[]
  onChange: (ids: number[]) => void | Promise<void>
}) {
  function toggleCategory(id: number) {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id]
    void onChange(next)
  }

  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => (
          <Chip
            key={category.id}
            active={selected.includes(category.id)}
            onClick={() => toggleCategory(category.id)}
          >
            {category.name}
            {category.count > 0 ? ` (${category.count})` : ''}
          </Chip>
        ))}
      </div>
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
    if (!rows.some((row) => row.agentUid === agent.uid)) {
      rows.push({ id: agent.uid, type: 'agent_output', agentUid: agent.uid, include: true })
    }
  }

  return rows
}
