import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { components } from '@project/sdk'
import { useUpdatePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PromptField } from './PromptField'

type Pipeline = components['schemas']['Pipeline']
type Agent = components['schemas']['PipelineAgent']

interface Props {
  agent: Agent
  pipeline: Pipeline
  pipelineId: string
  onDeleted: () => void
}

const OUTPUT_TARGETS = [
  { value: 'none', label: 'Not included in final post' },
  { value: 'body', label: 'Body (section)' },
  { value: 'image', label: 'Inline image' },
  { value: 'title', label: 'Title' },
  { value: 'excerpt', label: 'Excerpt' },
  { value: 'thumbnail_prompt', label: 'Thumbnail prompt' },
] as const
const OUTPUT_FORMATS = ['text', 'markdown', 'json'] as const

export function BuilderAgent({ agent, pipeline, pipelineId, onDeleted }: Props) {
  const update = useUpdatePipeline()
  const [form, setForm] = useState({
    uid: agent.uid,
    name: agent.name,
    outputTarget: agent.outputTarget,
    outputFormat: agent.outputFormat,
    enabled: agent.enabled,
    systemPrompt: agent.systemPrompt,
    userPrompt: agent.userPrompt,
  })

  useEffect(() => {
    setForm({
      uid: agent.uid,
      name: agent.name,
      outputTarget: agent.outputTarget,
      outputFormat: agent.outputFormat,
      enabled: agent.enabled,
      systemPrompt: agent.systemPrompt,
      userPrompt: agent.userPrompt,
    })
  }, [agent.id])

  function patch<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    await update.mutateAsync({
      pipelineId,
      agents: pipeline.agents.map((a) =>
        a.id === agent.id
          ? {
              id: a.id,
              uid: form.uid,
              name: form.name,
              systemPrompt: form.systemPrompt,
              userPrompt: form.userPrompt,
              outputTarget: form.outputTarget as any,
              outputFormat: form.outputFormat as any,
              enabled: form.enabled,
              sortOrder: a.sortOrder,
            }
          : {
              id: a.id,
              uid: a.uid,
              name: a.name,
              systemPrompt: a.systemPrompt,
              userPrompt: a.userPrompt,
              outputTarget: a.outputTarget as any,
              outputFormat: a.outputFormat as any,
              enabled: a.enabled,
              sortOrder: a.sortOrder,
            }
      ),
    })
    toast.success('Agent saved')
  }

  async function handleDelete() {
    await update.mutateAsync({
      pipelineId,
      agents: pipeline.agents
        .filter((a) => a.id !== agent.id)
        .map((a) => ({
          id: a.id,
          uid: a.uid,
          name: a.name,
          systemPrompt: a.systemPrompt,
          userPrompt: a.userPrompt,
          outputTarget: a.outputTarget as any,
          outputFormat: a.outputFormat as any,
          enabled: a.enabled,
          sortOrder: a.sortOrder,
        })),
    })
    toast.success('Agent deleted')
    onDeleted()
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <h2 className="text-sm font-semibold">Agent</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="UID">
          <Input
            value={form.uid}
            onChange={(e) => patch('uid', e.target.value)}
            placeholder="researcher"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">Used in <code className="bg-muted px-1 rounded">{`{agents.${form.uid || 'uid'}.output}`}</code></p>
        </Field>
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder="Researcher"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Output target">
          <select
            value={form.outputTarget}
            onChange={(e) => patch('outputTarget', e.target.value as any)}
            className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {OUTPUT_TARGETS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Output format">
          <select
            value={form.outputFormat}
            onChange={(e) => patch('outputFormat', e.target.value as any)}
            className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {OUTPUT_FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => patch('enabled', e.target.checked)}
          />
          Enabled
        </label>
      </Field>

      <PromptField
        label="System Prompt"
        value={form.systemPrompt}
        onChange={(v) => patch('systemPrompt', v)}
        promptKind="system"
        pipeline={pipeline}
        agent={agent}
        placeholder="You are a research assistant..."
      />

      <PromptField
        label="User Prompt"
        value={form.userPrompt}
        onChange={(v) => patch('userPrompt', v)}
        promptKind="user"
        pipeline={pipeline}
        agent={agent}
        placeholder="Research the topic: {subject}"
      />

      <div className="flex gap-2">
        <Button size="sm" loading={update.isPending} onClick={handleSave}>Save</Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>Delete</Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      {children}
    </div>
  )
}
