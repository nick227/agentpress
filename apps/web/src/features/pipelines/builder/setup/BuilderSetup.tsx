import { useState } from 'react'
import { toast } from 'sonner'
import { Play, Zap, Plus, Trash2, Globe, ChevronDown, FlaskConical } from 'lucide-react'
import type { components } from '@project/sdk'
import {
  useUpdatePipeline,
  useStartPipelineRun,
  useDestinations,
  useCreateDestination,
  useDeleteDestination,
  useResearchSources,
  useSummaryPrompts,
} from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Pipeline = components['schemas']['Pipeline']

interface Props {
  pipeline: Pipeline
  pipelineId: string
  onRunCreated: (runId: string) => void
}

export function BuilderSetup({ pipeline, pipelineId, onRunCreated }: Props) {
  const update = useUpdatePipeline()
  const startRun = useStartPipelineRun()
  const { data: destinationsData, refetch: refetchDestinations } = useDestinations(pipeline.accountId)
  const { data: researchData } = useResearchSources(pipeline.accountId)
  const { data: promptData } = useSummaryPrompts()
  const createDestination = useCreateDestination()
  const deleteDestination = useDeleteDestination()
  const destinations = destinationsData?.data ?? []
  const researchSources = researchData?.data ?? []
  const summaryPrompts = promptData?.data ?? []

  const [nameInput, setNameInput] = useState(pipeline.name)
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [showAddDestination, setShowAddDestination] = useState(false)
  const [forceRegenerate, setForceRegenerate] = useState(false)
  const [forceRegenerateAgentUids, setForceRegenerateAgentUids] = useState<string[]>([])
  const [runVars, setRunVars] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const v of pipeline.variables) {
      defaults[v.key] = String(v.defaultValue ?? v.exampleValue ?? '')
    }
    return defaults
  })
  const [dryRun, setDryRun] = useState(pipeline.dryRun)
  const [destForm, setDestForm] = useState({
    name: '',
    siteUrl: '',
    username: '',
    secret: '',
    defaultStatus: 'draft' as 'draft' | 'publish',
  })

  async function handleSave(fields: Partial<typeof pipeline>) {
    await update.mutateAsync({ pipelineId, ...fields })
    toast.success('Saved')
  }

  async function handleNameBlur() {
    if (nameInput.trim() && nameInput !== pipeline.name) {
      await update.mutateAsync({ pipelineId, name: nameInput.trim() })
      toast.success('Pipeline renamed')
    }
  }

  async function handleRun() {
    const result = await startRun.mutateAsync({
      pipelineId,
      variables: runVars,
      dryRun,
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
    if (!destForm.name || !destForm.siteUrl || !destForm.secret) {
      toast.error('Name, Site URL and Application Password are required')
      return
    }
    await createDestination.mutateAsync({
      accountId: pipeline.accountId,
      name: destForm.name,
      siteUrl: destForm.siteUrl,
      username: destForm.username || undefined,
      secret: destForm.secret,
      defaultStatus: destForm.defaultStatus,
    })
    toast.success('Destination added')
    setDestForm({ name: '', siteUrl: '', username: '', secret: '', defaultStatus: 'draft' })
    setShowAddDestination(false)
    refetchDestinations()
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

  return (
    <div className="p-6 max-w-lg space-y-6">

      {/* Name + Run */}
      <div className="flex items-center gap-2">
        <Input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 font-medium"
        />
        <Button onClick={() => setShowRunDialog(true)} size="sm" className="gap-1.5 shrink-0">
          <Play size={13} />
          Run
        </Button>
      </div>

      {/* Destination */}
      <div className="space-y-2">
        <Label>Destination</Label>
        {destinations.length > 0 ? (
          <div className="space-y-1.5">
            {destinations.map((d) => {
              const isActive = pipeline.destinationId === d.id
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
                    isActive ? 'border-accent bg-accent/5' : 'border-input-border bg-surface hover:bg-muted/40'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                    onClick={() => handleSave({ destinationId: isActive ? undefined : d.id })}
                  >
                    <Globe size={13} className="text-muted-foreground shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{d.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">{d.siteUrl}</span>
                    </span>
                    {isActive && (
                      <span className="text-xs text-accent font-medium shrink-0">Active</span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteDestination(d.id)}
                    loading={deleteDestination.isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              )
            })}
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
              <div className="flex gap-2">
                {(['draft', 'publish'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDestForm((f) => ({ ...f, defaultStatus: s }))}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                      destForm.defaultStatus === s
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-input-border hover:bg-muted'
                    }`}
                  >
                    {s === 'draft' ? 'Save as draft' : 'Publish directly'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" loading={createDestination.isPending} onClick={handleAddDestination}>
                Add destination
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddDestination(false)}>
                Cancel
              </Button>
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
      </div>

      {/* Research */}
      <div className="space-y-2">
        <Label>Research</Label>
        <Row label="Feed">
          <select
            value={pipeline.researchSourceId ?? ''}
            onChange={(e) => handleSave({
              researchSourceId: e.target.value || null,
              researchSummaryPromptId: e.target.value ? pipeline.researchSummaryPromptId : null,
            })}
            className="w-full h-8 rounded border border-input-border bg-background px-2 text-sm"
          >
            <option value="">No research feed</option>
            {researchSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} ({source.sourceType})
              </option>
            ))}
          </select>
        </Row>
        {pipeline.researchSourceId && (
          <>
            <Row label="Summary">
              <select
                value={pipeline.researchSummaryPromptId ?? ''}
                onChange={(e) => handleSave({ researchSummaryPromptId: e.target.value || null })}
                className="w-full h-8 rounded border border-input-border bg-background px-2 text-sm"
              >
                <option value="">Default summary prompt</option>
                {summaryPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}{prompt.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </Row>
            <div className="flex items-start gap-2 rounded border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <FlaskConical size={13} className="mt-0.5 shrink-0" />
              <span>
                This feed is the default <code className="font-mono text-foreground">{'{research.summary}'}</code>. Any connected feed can also be referenced by slug, such as <code className="font-mono text-foreground">{'{ziptrader.summary}'}</code>.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Run mode + Schedule — collapsed into a compact row group */}
      <div className="space-y-3">
        <Label>Settings</Label>

        <Row label="Run mode">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pipeline.dryRun}
              onChange={(e) => handleSave({ dryRun: e.target.checked })}
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
                            className={`px-2 py-1 rounded border text-xs transition-colors ${
                              active ? 'bg-foreground text-background border-foreground' : 'border-input-border hover:bg-muted'
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
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
        active
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
