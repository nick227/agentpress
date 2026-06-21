import { useState } from 'react'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PromptTextarea } from '@/components/ui/PromptTextarea'

type Prompt = components['schemas']['Prompt']
type PromptKind = Prompt['kind']

export type PromptFormValues = {
  name: string
  description?: string
  kind: PromptKind
  category: string
  tags: string[]
  systemPrompt: string
  userPrompt: string
  uid?: string
  outputTarget?: string
  outputFormat?: string
  isDefault?: boolean
}

const OUTPUT_TARGETS = ['body', 'title', 'excerpt', 'image', 'thumbnail', 'none'] as const
const OUTPUT_FORMATS = ['text', 'markdown', 'json', 'static', 'image'] as const

const KIND_HINT: Record<PromptKind, string> = {
  TRANSFORMATIONAL: 'Uses {variables} and {agents.uid.output} references — ideal for pipeline agents.',
  CONTENT: 'Uses content placeholders like {transcript} — ideal for research summaries.',
}

export function promptToFormValues(prompt: Prompt): PromptFormValues {
  return {
    name: prompt.name,
    description: prompt.description,
    kind: prompt.kind,
    category: prompt.category,
    tags: prompt.tags ?? [],
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    uid: prompt.uid,
    outputTarget: prompt.outputTarget,
    outputFormat: prompt.outputFormat,
    isDefault: prompt.isDefault,
  }
}

export function PromptForm({
  initial,
  onSubmit,
  onCancel,
  saving,
  submitLabel = 'Save',
}: {
  initial?: PromptFormValues
  onSubmit: (values: PromptFormValues) => Promise<void>
  onCancel?: () => void
  saving?: boolean
  submitLabel?: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [kind, setKind] = useState<PromptKind>(initial?.kind ?? 'TRANSFORMATIONAL')
  const [category, setCategory] = useState(initial?.category ?? 'general')
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [userPrompt, setUserPrompt] = useState(initial?.userPrompt ?? '')
  const [uid, setUid] = useState(initial?.uid ?? '')
  const [outputTarget, setOutputTarget] = useState(initial?.outputTarget ?? 'body')
  const [outputFormat, setOutputFormat] = useState(initial?.outputFormat ?? 'text')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)

  const valid = Boolean(name.trim() && systemPrompt.trim() && userPrompt.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      kind,
      category: category.trim() || 'general',
      tags,
      systemPrompt: systemPrompt.trim(),
      userPrompt: userPrompt.trim(),
      uid: uid.trim() || undefined,
      outputTarget: kind === 'TRANSFORMATIONAL' ? outputTarget : undefined,
      outputFormat: kind === 'TRANSFORMATIONAL' ? outputFormat : undefined,
      isDefault: kind === 'CONTENT' ? isDefault : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Outline Strategist" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this prompt does" />
        </Field>
        <Field label="Kind">
          <div className="flex gap-3">
            {(['TRANSFORMATIONAL', 'CONTENT'] as const).map((value) => (
              <label key={value} className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={kind === value} onChange={() => setKind(value)} />
                {value === 'TRANSFORMATIONAL' ? 'Transformational' : 'Content'}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{KIND_HINT[kind]}</p>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="writing, research, seo…" />
          </Field>
          <Field label="Tags">
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="comma-separated" />
          </Field>
        </div>
      </section>

      {kind === 'TRANSFORMATIONAL' && (
        <section className="rounded border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Pipeline agent defaults</h2>
          <p className="text-xs text-muted-foreground -mt-2">Applied when adding this prompt to a pipeline.</p>
          <Field label="Agent UID">
            <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="outline_strategist" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Output target">
              <select
                value={outputTarget}
                onChange={(e) => setOutputTarget(e.target.value)}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                {OUTPUT_TARGETS.map((target) => (
                  <option key={target} value={target}>{target}</option>
                ))}
              </select>
            </Field>
            <Field label="Output format">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Prompt text</h2>
        <Field label="System prompt">
          <PromptTextarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="font-mono text-sm resize-y min-h-[120px]"
            placeholder="You are a senior content strategist…"
          />
        </Field>
        <Field label="User prompt">
          <PromptTextarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={8}
            className="font-mono text-sm resize-y min-h-[180px]"
            placeholder={kind === 'CONTENT' ? 'Summarize:\n\n{transcript}' : 'Topic: {topic}\nAudience: {audience}'}
          />
        </Field>
        {kind === 'CONTENT' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isDefault" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-3.5 w-3.5" />
            <label htmlFor="isDefault" className="text-sm text-muted-foreground">Use as global default for research summaries</label>
          </div>
        )}
      </section>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" loading={saving} disabled={!valid || saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
