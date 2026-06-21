import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, Play, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useCreateSchedule,
  useDeleteSchedule,
  usePipeline,
  usePipelines,
  useResearchSources,
  useRunSchedule,
  useSchedule,
  useScheduleExecutions,
  useUpdateSchedule,
  type ScheduleInput,
} from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

type TriggerPolicy = 'always' | 'any_checked_feed_new' | 'selected_feeds_new'
type ActionForm = {
  id?: string
  pipelineId: string
  triggerPolicy: TriggerPolicy
  triggerSourceIds: string[]
  variableOverrides: Record<string, unknown>
}
type FormState = {
  name: string
  enabled: boolean
  cadenceType: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  timezone: string
  minuteOfHour: number
  timeOfDay: string
  dayOfWeek: number
  dayOfMonth: number
  sourceIds: string[]
  pipelineActions: ActionForm[]
}

const SELECT_CLASS = 'w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const defaultForm = (): FormState => ({
  name: '',
  enabled: false,
  cadenceType: 'manual',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  minuteOfHour: 0,
  timeOfDay: '09:00',
  dayOfWeek: 1,
  dayOfMonth: 1,
  sourceIds: [],
  pipelineActions: [],
})

export function ScheduleEditorPage() {
  const { scheduleId = 'new' } = useParams<{ scheduleId: string }>()
  const isNew = scheduleId === 'new'
  const navigate = useNavigate()
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule(isNew ? '' : scheduleId)
  const { data: sourcesData } = useResearchSources()
  const { data: pipelinesData } = usePipelines()
  const { data: executionsData } = useScheduleExecutions(isNew ? '' : scheduleId)
  const create = useCreateSchedule()
  const update = useUpdateSchedule()
  const remove = useDeleteSchedule()
  const run = useRunSchedule()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [baseline, setBaseline] = useState(() => JSON.stringify(defaultForm()))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const schedule = scheduleData?.data
  const sources = sourcesData?.data ?? []
  const pipelines = pipelinesData?.data ?? []
  const executions = executionsData?.data ?? []

  useEffect(() => {
    if (!schedule) return
    const next: FormState = {
      name: schedule.name,
      enabled: schedule.enabled,
      cadenceType: schedule.cadenceType,
      timezone: schedule.timezone,
      minuteOfHour: schedule.minuteOfHour ?? 0,
      timeOfDay: schedule.timeOfDay ?? '09:00',
      dayOfWeek: schedule.dayOfWeek ?? 1,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      sourceIds: schedule.sourceIds,
      pipelineActions: schedule.pipelineActions.map((action) => ({
        id: action.id,
        pipelineId: action.pipelineId,
        triggerPolicy: action.triggerPolicy,
        triggerSourceIds: action.triggerSourceIds,
        variableOverrides: action.variableOverrides,
      })),
    }
    setForm(next)
    setBaseline(JSON.stringify(next))
  }, [schedule])

  const dirty = JSON.stringify(form) !== baseline
  const pending = create.isPending || update.isPending
  const canSave = form.name.trim() && (form.sourceIds.length > 0 || form.pipelineActions.length > 0) && dirty && !pending

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleSource(sourceId: string) {
    setForm((current) => {
      const selected = current.sourceIds.includes(sourceId)
      const sourceIds = selected ? current.sourceIds.filter((id) => id !== sourceId) : [...current.sourceIds, sourceId]
      return {
        ...current,
        sourceIds,
        pipelineActions: current.pipelineActions.map((action) => ({
          ...action,
          triggerSourceIds: action.triggerSourceIds.filter((id) => sourceIds.includes(id)),
        })),
      }
    })
  }

  function addPipeline() {
    const pipeline = pipelines.find((item) => !form.pipelineActions.some((action) => action.pipelineId === item.id))
    if (!pipeline) return
    patch('pipelineActions', [...form.pipelineActions, {
      pipelineId: pipeline.id,
      triggerPolicy: 'always',
      triggerSourceIds: [],
      variableOverrides: {},
    }])
  }

  function updateAction(index: number, next: ActionForm) {
    patch('pipelineActions', form.pipelineActions.map((action, actionIndex) => actionIndex === index ? next : action))
  }

  function moveAction(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.pipelineActions.length) return
    const pipelineActions = [...form.pipelineActions]
    ;[pipelineActions[index], pipelineActions[target]] = [pipelineActions[target]!, pipelineActions[index]!]
    patch('pipelineActions', pipelineActions)
  }

  function requestBody(): ScheduleInput {
    return {
      name: form.name.trim(),
      enabled: form.enabled,
      cadenceType: form.cadenceType,
      timezone: form.timezone,
      minuteOfHour: form.cadenceType === 'hourly' ? form.minuteOfHour : null,
      timeOfDay: ['daily', 'weekly', 'monthly'].includes(form.cadenceType) ? form.timeOfDay : null,
      dayOfWeek: form.cadenceType === 'weekly' ? form.dayOfWeek : null,
      dayOfMonth: form.cadenceType === 'monthly' ? form.dayOfMonth : null,
      sourceIds: form.sourceIds,
      pipelineActions: form.pipelineActions,
    }
  }

  async function handleSave() {
    try {
      const result = isNew
        ? await create.mutateAsync(requestBody())
        : await update.mutateAsync({ scheduleId, ...requestBody() })
      toast.success(isNew ? 'Schedule created' : 'Schedule saved')
      if (isNew) navigate(`/schedules/${result.data.id}`, { replace: true })
      else setBaseline(JSON.stringify(form))
    } catch (error: any) {
      toast.error(error.message ?? 'Could not save schedule')
    }
  }

  async function handleRun() {
    try {
      await run.mutateAsync(scheduleId)
      toast.success('Schedule execution queued')
    } catch (error: any) {
      toast.error(error.message ?? 'Could not run schedule')
    }
  }

  async function handleDelete() {
    await remove.mutateAsync(scheduleId)
    toast.success('Schedule deleted')
    navigate('/schedules', { replace: true })
  }

  if (!isNew && scheduleLoading) return <div className="page-shell"><Skeleton className="h-48 w-full" /></div>
  if (!isNew && !schedule) return <div className="page-shell">Schedule not found.</div>

  return (
    <div className="page-shell space-y-6">
      <Link to="/schedules" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Schedules
      </Link>

      <div className="page-header gap-4">
        <div className="min-w-0 flex-1 max-w-xl">
          <Input value={form.name} onChange={(event) => patch('name', event.target.value)} placeholder="Schedule name" className="text-base font-medium" />
          {!isNew && schedule?.nextRunAt && <p className="text-xs text-muted-foreground mt-1">Next run {new Date(schedule.nextRunAt).toLocaleString()}</p>}
        </div>
        <div className="page-header-actions">
          {!isNew && <Button variant="outline" size="sm" loading={run.isPending} disabled={dirty || run.isPending} title={dirty ? 'Save changes before running' : undefined} onClick={handleRun}><Play size={13} /> Run now</Button>}
          <Button size="sm" loading={pending} disabled={!canSave} onClick={handleSave}>Save</Button>
        </div>
      </div>

      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Timing</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} disabled={form.cadenceType === 'manual'} onChange={(event) => patch('enabled', event.target.checked)} /> Enabled for timed runs</label>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Cadence">
            <select value={form.cadenceType} onChange={(event) => { const cadenceType = event.target.value as FormState['cadenceType']; setForm((current) => ({ ...current, cadenceType, enabled: cadenceType === 'manual' ? false : current.enabled })) }} className={SELECT_CLASS}>
              <option value="manual">Manual only</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="IANA timezone"><Input value={form.timezone} onChange={(event) => patch('timezone', event.target.value)} /></Field>
          {form.cadenceType === 'hourly' && <Field label="Minute of hour"><Input type="number" min={0} max={59} value={form.minuteOfHour} onChange={(event) => patch('minuteOfHour', Number(event.target.value))} /></Field>}
          {['daily', 'weekly', 'monthly'].includes(form.cadenceType) && <Field label="Local time"><Input type="time" value={form.timeOfDay} onChange={(event) => patch('timeOfDay', event.target.value)} /></Field>}
          {form.cadenceType === 'weekly' && <Field label="Weekday"><select value={form.dayOfWeek} onChange={(event) => patch('dayOfWeek', Number(event.target.value))} className={SELECT_CLASS}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field>}
          {form.cadenceType === 'monthly' && <Field label="Day of month"><Input type="number" min={1} max={28} value={form.dayOfMonth} onChange={(event) => patch('dayOfMonth', Number(event.target.value))} /></Field>}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <div><h2 className="text-sm font-semibold">Research feeds</h2><p className="text-xs text-muted-foreground">Each selected feed is checked once per execution.</p></div>
        {sources.length === 0 ? <p className="text-sm text-muted-foreground">No research feeds yet.</p> : (
          <div className="grid sm:grid-cols-2 gap-2">
            {sources.map((source) => <label key={source.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><input type="checkbox" checked={form.sourceIds.includes(source.id)} onChange={() => toggleSource(source.id)} />{source.name}</label>)}
          </div>
        )}
      </section>

      <section className="rounded border p-4 space-y-3">
        <div className="section-header">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Pipeline actions</h2>
            <p className="text-xs text-muted-foreground">Actions evaluate freshness independently.</p>
          </div>
          <Button variant="outline" size="sm" disabled={form.pipelineActions.length === pipelines.length} onClick={addPipeline}>
            <Plus size={13} /> Add pipeline
          </Button>
        </div>
        {form.pipelineActions.length === 0 && <p className="text-sm text-muted-foreground">This schedule only checks research feeds.</p>}
        {form.pipelineActions.map((action, index) => (
          <PipelineActionCard key={action.id ?? `${action.pipelineId}-${index}`} action={action} index={index} actionCount={form.pipelineActions.length} sourceIds={form.sourceIds} sources={sources} pipelines={pipelines} usedPipelineIds={form.pipelineActions.map((item) => item.pipelineId)} onChange={(next) => updateAction(index, next)} onMove={(direction) => moveAction(index, direction)} onRemove={() => patch('pipelineActions', form.pipelineActions.filter((_, itemIndex) => itemIndex !== index))} />
        ))}
      </section>

      {!isNew && <ExecutionHistory executions={executions} pipelines={pipelines} />}

      {!isNew && <section className="border-t pt-4">{confirmDelete ? <div className="flex gap-2"><Button variant="destructive" size="sm" loading={remove.isPending} onClick={handleDelete}>Delete schedule</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button></div> : <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete schedule</Button>}</section>}
    </div>
  )
}

function PipelineActionCard({ action, index, actionCount, sourceIds, sources, pipelines, usedPipelineIds, onChange, onMove, onRemove }: {
  action: ActionForm
  index: number
  actionCount: number
  sourceIds: string[]
  sources: components['schemas']['ResearchSource'][]
  pipelines: components['schemas']['PipelineSummary'][]
  usedPipelineIds: string[]
  onChange: (action: ActionForm) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const { data } = usePipeline(action.pipelineId)
  const pipeline = data?.data
  const available = pipelines.filter((item) => item.id === action.pipelineId || !usedPipelineIds.includes(item.id))
  const variables = pipeline?.variables ?? []
  return (
    <div className="rounded border bg-muted/10 p-3 space-y-3">
      <div className="flex gap-2">
        <select value={action.pipelineId} onChange={(event) => onChange({ ...action, id: undefined, pipelineId: event.target.value, triggerSourceIds: [], variableOverrides: {} })} className={`${SELECT_CLASS} flex-1`}>
          {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move action up"><ArrowUp size={13} /></Button>
        <Button variant="ghost" size="icon-sm" disabled={index === actionCount - 1} onClick={() => onMove(1)} aria-label="Move action down"><ArrowDown size={13} /></Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove pipeline action ${index + 1}`}><Trash2 size={13} /></Button>
      </div>
      {pipeline && <>
        <p className="text-xs text-muted-foreground">{pipeline.status} · {pipeline.dryRun ? 'Dry run' : 'Live run'}</p>
        {pipeline.status !== 'active' && <p className="text-xs text-amber-700">This action will be skipped until the pipeline is active.</p>}
      </>}
      <Field label="Trigger policy">
        <select value={action.triggerPolicy} onChange={(event) => onChange({ ...action, triggerPolicy: event.target.value as TriggerPolicy, triggerSourceIds: [] })} className={SELECT_CLASS}>
          <option value="always">Always run</option>
          <option value="any_checked_feed_new">Run if any checked feed is new</option>
          <option value="selected_feeds_new">Run if selected feeds are new</option>
        </select>
      </Field>
      {action.triggerPolicy === 'selected_feeds_new' && <Field label="Trigger feeds"><div className="flex flex-wrap gap-2">{sources.filter((source) => sourceIds.includes(source.id)).map((source) => <label key={source.id} className="text-xs flex items-center gap-1"><input type="checkbox" checked={action.triggerSourceIds.includes(source.id)} onChange={() => onChange({ ...action, triggerSourceIds: action.triggerSourceIds.includes(source.id) ? action.triggerSourceIds.filter((id) => id !== source.id) : [...action.triggerSourceIds, source.id] })} />{source.name}</label>)}</div></Field>}
      {variables.length > 0 && <div className="grid sm:grid-cols-2 gap-2">{variables.map((variable) => <Field key={variable.id} label={`${variable.label || variable.key}${variable.required ? ' *' : ''}`}><Input value={String(action.variableOverrides[variable.key] ?? variable.defaultValue ?? '')} placeholder={String(variable.defaultValue ?? '')} onChange={(event) => onChange({ ...action, variableOverrides: { ...action.variableOverrides, [variable.key]: event.target.value } })} /></Field>)}</div>}
    </div>
  )
}

function ExecutionHistory({ executions, pipelines }: { executions: components['schemas']['ScheduleExecution'][]; pipelines: components['schemas']['PipelineSummary'][] }) {
  return <section className="rounded border p-4 space-y-3"><h2 className="text-sm font-semibold">Execution history</h2>{executions.length === 0 ? <p className="text-sm text-muted-foreground">No executions yet.</p> : executions.map((execution) => <details key={execution.id} className="rounded border px-3 py-2"><summary className="cursor-pointer text-sm"><span className="font-medium capitalize">{execution.status}</span><span className="text-muted-foreground"> · {execution.origin} · {new Date(execution.createdAt).toLocaleString()}</span></summary><div className="pt-3 space-y-2">{execution.skipReason && <p className="text-xs text-muted-foreground">{execution.skipReason}</p>}{execution.error && <p className="text-xs text-destructive">{execution.error}</p>}{execution.researchChecks.map((check) => <p key={check.id} className="text-xs">{check.sourceName}: {check.status}{check.status === 'completed' ? ` · ${check.newCount} new` : ''}{check.error ? ` · ${check.error}` : ''}</p>)}{execution.pipelineExecutions.map((item) => { const pipeline = pipelines.find((entry) => entry.id === item.pipelineId); return <div key={item.id} className="text-xs"><p>{item.pipelineName}: {item.status}{item.reason ? ` · ${item.reason}` : ''}{item.pipelineRunId && pipeline ? <> · <Link className="text-primary hover:underline" to={`/pipelines/${pipeline.slug}?run=${item.pipelineRunId}`}>View run</Link></> : null}</p>{item.pinnedItems.map((pinned) => <p key={pinned.itemId} className="text-muted-foreground pl-3">Pinned: {pinned.title}</p>)}</div> })}</div></details>)}</section>
}

