import { useState } from 'react'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PromptTextarea } from '@/components/ui/PromptTextarea'

type Agent = components['schemas']['Agent']
export type AgentFormValues = components['schemas']['AgentInput']

const KINDS: Array<{ value: Agent['kind']; label: string }> = [
  { value: 'AI_TEXT', label: 'AI text' },
  { value: 'AI_IMAGE', label: 'AI image' },
  { value: 'STATIC_TEXT', label: 'Static text' },
  { value: 'STATIC_IMAGE', label: 'Static image' },
]

function defaultsForKind(kind: Agent['kind']) {
  if (kind === 'AI_IMAGE') return { outputFormat: 'image', outputTarget: 'image' }
  if (kind === 'STATIC_IMAGE') return { outputFormat: 'static', outputTarget: 'image' }
  if (kind === 'STATIC_TEXT') return { outputFormat: 'static', outputTarget: 'body' }
  return { outputFormat: 'markdown', outputTarget: 'body' }
}

export function agentToFormValues(agent: Agent): AgentFormValues {
  return {
    name: agent.name, key: agent.key, description: agent.description, category: agent.category,
    tags: agent.tags, kind: agent.kind, defaultUid: agent.defaultUid, systemPrompt: agent.systemPrompt,
    userPrompt: agent.userPrompt, outputTarget: agent.outputTarget, outputFormat: agent.outputFormat,
    sourceAgentId: agent.sourceAgentId,
  }
}

export function AgentForm({ initial, saving, onSubmit }: {
  initial?: Partial<AgentFormValues>
  saving?: boolean
  onSubmit: (values: AgentFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AgentFormValues>({
    name: initial?.name ?? '', key: initial?.key, description: initial?.description,
    category: initial?.category ?? 'general', tags: initial?.tags ?? [], kind: initial?.kind ?? 'AI_TEXT',
    defaultUid: initial?.defaultUid ?? 'agent', systemPrompt: initial?.systemPrompt ?? '',
    userPrompt: initial?.userPrompt ?? '', outputTarget: initial?.outputTarget ?? 'body',
    outputFormat: initial?.outputFormat ?? 'markdown', sourceAgentId: initial?.sourceAgentId,
  })
  const [tags, setTags] = useState((form.tags ?? []).join(', '))
  const patch = <K extends keyof AgentFormValues>(key: K, value: AgentFormValues[K]) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault()
      void onSubmit({ ...form, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) })
    }}>
      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Agent definition</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => patch('name', e.target.value)} /></Field>
          <Field label="Default UID"><Input className="font-mono" value={form.defaultUid} onChange={(e) => patch('defaultUid', e.target.value)} /></Field>
        </div>
        <Field label="Description"><Input value={form.description ?? ''} onChange={(e) => patch('description', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Input value={form.category ?? ''} onChange={(e) => patch('category', e.target.value)} /></Field>
          <Field label="Tags"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="writing, seo" /></Field>
        </div>
        <Field label="Kind">
          <select className="h-9 w-full rounded border bg-background px-3 text-sm" value={form.kind} onChange={(e) => {
            const kind = e.target.value as Agent['kind']
            setForm((current) => ({ ...current, kind, ...defaultsForKind(kind) }))
          }}>
            {KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Output target"><Input value={form.outputTarget} onChange={(e) => patch('outputTarget', e.target.value)} /></Field>
          <Field label="Output format"><Input value={form.outputFormat} readOnly className="bg-muted/30" /></Field>
        </div>
        {form.kind === 'STATIC_IMAGE' && <p className="text-xs text-muted-foreground">The actual image is selected after inserting this Agent into a pipeline.</p>}
      </section>
      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Content and prompts</h2>
        {form.kind === 'AI_TEXT' && <Field label="System prompt"><PromptTextarea rows={6} value={form.systemPrompt} onChange={(e) => patch('systemPrompt', e.target.value)} /></Field>}
        <Field label={form.kind === 'STATIC_TEXT' ? 'Static content' : form.kind === 'STATIC_IMAGE' ? 'Alt text / note' : 'User prompt'}>
          <PromptTextarea rows={9} value={form.userPrompt} onChange={(e) => patch('userPrompt', e.target.value)} />
        </Field>
      </section>
      <div className="flex justify-end"><Button type="submit" size="sm" loading={saving} disabled={!form.name.trim() || !form.defaultUid.trim() || saving}>Save Agent</Button></div>
    </form>
  )
}
