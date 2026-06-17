import { useState } from 'react'
import { toast } from 'sonner'
import { Play, Zap, Plus, Trash2, Globe } from 'lucide-react'
import type { components } from '@project/sdk'
import { useUpdatePipeline, useStartPipelineRun, useDestinations, useCreateDestination, useDeleteDestination } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PipelineStatusBadge } from '../../PipelineStatusBadge'

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
  const createDestination = useCreateDestination()
  const deleteDestination = useDeleteDestination()
  const destinations = destinationsData?.data ?? []

  const [nameInput, setNameInput] = useState(pipeline.name)
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [showAddDestination, setShowAddDestination] = useState(false)
  const [runVars, setRunVars] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const v of pipeline.variables) {
      defaults[v.key] = String(v.defaultValue ?? v.exampleValue ?? '')
    }
    return defaults
  })
  const [dryRun, setDryRun] = useState(pipeline.dryRun)

  // Destination form state
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
    const result = await startRun.mutateAsync({ pipelineId, variables: runVars, dryRun })
    toast.success(dryRun ? 'Dry run started' : 'Live run started')
    setShowRunDialog(false)
    onRunCreated(result.data.id)
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
      await handleSave({ destinationId: undefined })
    }
    refetchDestinations()
  }

  return (
    <div className="p-6 max-w-xl">

      {/* Pipeline name */}
      <Section title="Pipeline name">
        <div className="flex items-center gap-2">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="flex-1"
          />
          <PipelineStatusBadge status={pipeline.status} />
        </div>
      </Section>

      {/* Destinations */}
      <Section title="Destinations">
        {destinations.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {destinations.map((d) => (
              <div
                key={d.id}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
                  pipeline.destinationId === d.id
                    ? 'border-accent bg-accent/5'
                    : 'border-input-border bg-surface hover:bg-muted/40'
                }`}
              >
                <button
                  type="button"
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                  onClick={() => handleSave({ destinationId: pipeline.destinationId === d.id ? undefined : d.id })}
                >
                  <Globe size={13} className="text-muted-foreground shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{d.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{d.siteUrl}</span>
                  </span>
                  {pipeline.destinationId === d.id && (
                    <span className="ml-auto text-xs text-accent font-medium shrink-0">Active</span>
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
            ))}
          </div>
        )}

        {destinations.length === 0 && !showAddDestination && (
          <p className="text-xs text-muted-foreground mb-3">No destinations yet. Add one to publish runs.</p>
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
            <div className="flex gap-2 pt-1">
              <Button size="sm" loading={createDestination.isPending} onClick={handleAddDestination}>
                Add destination
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddDestination(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddDestination(true)}
          >
            <Plus size={13} />
            Add WordPress destination
          </Button>
        )}
      </Section>

      {/* Run mode */}
      <Section title="Run mode">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={pipeline.dryRun}
            onChange={(e) => handleSave({ dryRun: e.target.checked })}
            className="rounded"
          />
          Dry run only (never publish remotely)
        </label>
      </Section>

      {/* Schedule */}
      <Section title="Schedule">
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['manual', 'recurring'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSave({ scheduleMode: mode })}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  pipeline.scheduleMode === mode
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-input-border hover:bg-muted'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {pipeline.scheduleMode === 'recurring' && (
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => handleSave({ frequency: freq })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    pipeline.frequency === freq
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-input-border hover:bg-muted'
                  }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
              <Input
                type="time"
                value={pipeline.timeOfDay ?? ''}
                onChange={(e) => handleSave({ timeOfDay: e.target.value })}
                className="w-32"
              />
            </div>
          )}
        </div>
      </Section>

      {/* Status */}
      <Section title="Pipeline status">
        <div className="flex gap-2">
          {(['draft', 'active', 'paused', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSave({ status: s })}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                pipeline.status === s
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-input-border hover:bg-muted'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* Run action */}
      <div className="mt-6 pt-5 border-t">
        <Button onClick={() => setShowRunDialog(true)} size="sm" className="gap-2">
          <Play size={13} />
          Run now
        </Button>
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

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Dry run (don't publish)
              </label>
            </div>
            <div className="px-5 pb-4 flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowRunDialog(false)}>Cancel</Button>
              <Button size="sm" loading={startRun.isPending} onClick={handleRun} className="gap-2">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}
