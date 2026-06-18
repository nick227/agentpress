import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useSummaryPrompts, useCreateSummaryPrompt, useUpdateSummaryPrompt, useDeleteSummaryPrompt } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'

type SummaryPrompt = components['schemas']['SummaryPrompt']

const PLACEHOLDER_HINT = `Use {transcript} to inject the collected item content.`

export function PromptsPanel() {
  const { data, isLoading } = useSummaryPrompts()
  const create = useCreateSummaryPrompt()
  const [showNew, setShowNew] = useState(false)

  const prompts = data?.data ?? []

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold">Summary Prompts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable AI prompts applied to collected research content. Use <code className="font-mono bg-muted px-1 rounded">{'{{transcript}}'}</code> in your user prompt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={13} />
          New Prompt
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {showNew && (
            <PromptForm
              onSave={async (values) => {
                await create.mutateAsync(values)
                toast.success('Prompt created')
                setShowNew(false)
              }}
              onCancel={() => setShowNew(false)}
              saving={create.isPending}
            />
          )}
          {prompts.map((prompt) => (
            <PromptRow key={prompt.id} prompt={prompt} />
          ))}
          {prompts.length === 0 && !showNew && (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No prompts yet. Create one to start generating summaries.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PromptRow({ prompt }: { prompt: SummaryPrompt }) {
  const update = useUpdateSummaryPrompt()
  const del = useDeleteSummaryPrompt()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) {
    return (
      <PromptForm
        initial={prompt}
        onSave={async (values) => {
          await update.mutateAsync({ promptId: prompt.id, ...values })
          toast.success('Prompt updated')
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
        saving={update.isPending}
      />
    )
  }

  return (
    <div className="border rounded-lg p-4 group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{prompt.name}</p>
            {prompt.isDefault && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">default</span>
            )}
          </div>
          {prompt.description && <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </Button>
          {!confirmDelete ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={12} />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                loading={del.isPending}
                onClick={async () => {
                  await del.mutateAsync(prompt.id)
                  toast.success('Prompt deleted')
                }}
              >
                <Check size={12} className="text-destructive" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)}>
                <X size={12} />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <PromptPreview label="System" text={prompt.systemPrompt} />
        <PromptPreview label="User" text={prompt.userPrompt} />
      </div>
    </div>
  )
}

function PromptPreview({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground w-10 shrink-0 pt-0.5">{label}</span>
      <p className="text-foreground/70 line-clamp-2 font-mono leading-relaxed">{text}</p>
    </div>
  )
}

function PromptForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: SummaryPrompt
  onSave: (v: { name: string; description?: string; systemPrompt: string; userPrompt: string; isDefault?: boolean }) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [userPrompt, setUserPrompt] = useState(initial?.userPrompt ?? '')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim() || !userPrompt.trim()) return
    await onSave({ name: name.trim(), description: description.trim() || undefined, systemPrompt: systemPrompt.trim(), userPrompt: userPrompt.trim(), isDefault })
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-muted/10">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" placeholder="e.g. News Brief" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-7 text-xs" placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">System Prompt</label>
        <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} className="text-xs font-mono resize-none" placeholder="You are a concise summarizer…" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">User Prompt</label>
        <Textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} rows={4} className="text-xs font-mono resize-none" placeholder={`Summarize this transcript:\n\n{transcript}`} />
        <p className="text-xs text-muted-foreground mt-1">{PLACEHOLDER_HINT}</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isDefault" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-3 w-3" />
        <label htmlFor="isDefault" className="text-xs text-muted-foreground">Mark as default</label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={saving} disabled={!name.trim() || !systemPrompt.trim() || !userPrompt.trim()}>
          {initial ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
