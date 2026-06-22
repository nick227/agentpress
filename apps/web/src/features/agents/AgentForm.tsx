import { useState } from 'react'
import type { components } from '@project/sdk'
import { useCreatePrompt } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PromptField } from '@/features/pipelines/builder/agents/PromptField'

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
  
  const createPrompt = useCreatePrompt()
  async function handleSaveSystemPrompt(name: string) {
    await createPrompt.mutateAsync({ name, category: form.category ?? 'Uncategorized', systemPrompt: form.systemPrompt, userPrompt: '' })
  }
  async function handleSaveUserPrompt(name: string) {
    await createPrompt.mutateAsync({ name, category: form.category ?? 'Uncategorized', systemPrompt: '', userPrompt: form.userPrompt })
  }

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault()
      void onSubmit({ ...form, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) })
    }}>
      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Agent definition</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => patch('name', e.target.value)} /></Field>
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
        {form.kind === 'STATIC_IMAGE' && <p className="text-xs text-muted-foreground">The actual image is selected after inserting this Agent into a pipeline.</p>}
      </section>
      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Content and prompts</h2>
        {form.kind === 'AI_TEXT' && (
          <PromptField
            label="System prompt"
            value={form.systemPrompt}
            onChange={(v) => patch('systemPrompt', v)}
            promptKind="system"
            defaultSaveName={`${form.name || 'Agent'} - System`}
            savingPrompt={createPrompt.isPending}
            onSavePrompt={handleSaveSystemPrompt}
          />
        )}
        <PromptField
          label={form.kind === 'STATIC_TEXT' ? 'Static content' : form.kind === 'STATIC_IMAGE' ? 'Alt text / note' : 'User prompt'}
          value={form.userPrompt}
          onChange={(v) => patch('userPrompt', v)}
          promptKind="user"
          defaultSaveName={`${form.name || 'Agent'} - User`}
          savingPrompt={createPrompt.isPending}
          onSavePrompt={handleSaveUserPrompt}
        />
      </section>
      <div className="flex justify-end"><Button type="submit" size="sm" loading={saving} disabled={!form.name.trim() || saving}>Save Agent</Button></div>
    </form>
  )
}
