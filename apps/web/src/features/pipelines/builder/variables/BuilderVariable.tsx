import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { components } from '@project/sdk'
import { useUpdatePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Pipeline = components['schemas']['Pipeline']
type PipeableVariable = components['schemas']['PipelineVariable']

interface Props {
  variable: PipeableVariable
  pipeline: Pipeline
  pipelineId: string
  onSaved: (id: string) => void
  onDeleted: () => void
}

const TYPES = ['text', 'long_text', 'number', 'boolean', 'json'] as const

export function BuilderVariable({ variable, pipeline, pipelineId, onSaved, onDeleted }: Props) {
  const update = useUpdatePipeline()
  const [form, setForm] = useState({
    key: variable.key,
    label: variable.label ?? '',
    type: variable.type,
    required: variable.required,
    defaultValue: String(variable.defaultValue ?? ''),
    exampleValue: String(variable.exampleValue ?? ''),
  })

  useEffect(() => {
    setForm({
      key: variable.key,
      label: variable.label ?? '',
      type: variable.type,
      required: variable.required,
      defaultValue: String(variable.defaultValue ?? ''),
      exampleValue: String(variable.exampleValue ?? ''),
    })
  }, [variable.id])

  function patchForm<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    const variableIndex = pipeline.variables.findIndex((v) => v.id === variable.id)
    const result = await update.mutateAsync({
      pipelineId,
      variables: pipeline.variables.map((v) =>
        v.id === variable.id
          ? {
              id: v.id,
              key: form.key,
              label: form.label || undefined,
              type: form.type as any,
              required: form.required,
              defaultValue: form.defaultValue || undefined,
              exampleValue: form.exampleValue || undefined,
              sortOrder: v.sortOrder,
            }
          : {
              id: v.id,
              key: v.key,
              label: v.label,
              type: v.type as any,
              required: v.required,
              defaultValue: v.defaultValue as any,
              exampleValue: v.exampleValue as any,
              sortOrder: v.sortOrder,
            }
      ),
    })
    const savedVariable = result.data.variables[variableIndex]
    if (savedVariable) onSaved(savedVariable.id)
    toast.success('Variable saved')
  }

  async function handleDelete() {
    await update.mutateAsync({
      pipelineId,
      variables: pipeline.variables
        .filter((v) => v.id !== variable.id)
        .map((v) => ({
          id: v.id,
          key: v.key,
          label: v.label,
          type: v.type as any,
          required: v.required,
          defaultValue: v.defaultValue as any,
          exampleValue: v.exampleValue as any,
          sortOrder: v.sortOrder,
        })),
    })
    toast.success('Variable deleted')
    onDeleted()
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-sm font-semibold mb-5">Variables</h2>

      <div className="space-y-4">
        <Field label="Key">
          <Input
            value={form.key}
            onChange={(e) => patchForm('key', e.target.value)}
            placeholder="subject"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">Reference in prompts as <code className="bg-muted px-1 rounded">{`{${form.key || 'key'}}`}</code></p>
        </Field>

        <Field label="Label">
          <Input
            value={form.label}
            onChange={(e) => patchForm('label', e.target.value)}
            placeholder="Subject"
          />
        </Field>

        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) => patchForm('type', e.target.value as any)}
            className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => patchForm('required', e.target.checked)}
            />
            Required
          </label>
        </Field>

        <Field label="Default value">
          <Input
            value={form.defaultValue}
            onChange={(e) => patchForm('defaultValue', e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Example value">
          <Input
            value={form.exampleValue}
            onChange={(e) => patchForm('exampleValue', e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
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
