import { useState } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useCreatePrompt, useDeletePrompt, usePrompt, useUpdatePrompt } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PromptForm, promptToFormValues, type PromptFormValues } from '@/features/prompts/PromptForm'

const EMPTY_CONTENT_FORM: PromptFormValues = {
  name: '',
  kind: 'CONTENT',
  category: 'research',
  tags: ['summary', 'research'],
  systemPrompt: '',
  userPrompt: '',
  isDefault: false,
}

export function PromptEditorPage() {
  const { promptId = 'new' } = useParams<{ promptId: string }>()
  const [searchParams] = useSearchParams()
  const isNew = promptId === 'new'
  const defaultKind = searchParams.get('kind') === 'CONTENT' ? 'CONTENT' : 'TRANSFORMATIONAL'
  const navigate = useNavigate()
  const { data: promptData, isLoading } = usePrompt(isNew ? '' : promptId)
  const prompt = promptData?.data
  const create = useCreatePrompt()
  const update = useUpdatePrompt()
  const remove = useDeletePrompt()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isCommunity = prompt?.visibility === 'PUBLIC'
  const pending = create.isPending || update.isPending

  async function handleSubmit(values: PromptFormValues) {
    try {
      if (isNew) {
        const result = await create.mutateAsync(values)
        toast.success('Prompt created')
        navigate(`/prompts/${result.data.slug}`, { replace: true })
      } else {
        await update.mutateAsync({ promptId: prompt!.id, ...values })
        toast.success('Prompt saved')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save prompt'
      toast.error(message)
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(prompt!.id)
      toast.success('Prompt deleted')
      navigate('/prompts', { replace: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not delete prompt'
      toast.error(message)
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="page-shell page-shell--3xl">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!isNew && !prompt) {
    return <div className="p-6">Prompt not found.</div>
  }

  const initial = isNew
    ? (defaultKind === 'CONTENT' ? EMPTY_CONTENT_FORM : {
        name: '',
        kind: 'TRANSFORMATIONAL' as const,
        category: 'general',
        tags: [],
        systemPrompt: '',
        userPrompt: '',
        outputTarget: 'body',
        outputFormat: 'text',
      })
    : promptToFormValues(prompt!)

  return (
    <div className="page-shell page-shell--3xl space-y-6">
      <Link to={isCommunity ? "/community?tab=prompts" : "/prompts"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> {isCommunity ? 'Community' : 'Prompts'}
      </Link>

      <div className="page-header gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{isNew ? 'New prompt' : prompt?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {isCommunity
              ? 'Community prompt — read-only template from the catalog.'
              : 'Reusable system and user prompts with variable placeholders.'}
          </p>
        </div>
      </div>

      {isCommunity ? (
        <div className="rounded border p-4 space-y-4 bg-muted/10">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-0.5">{prompt!.kind}</span>
            <span className="rounded bg-muted px-2 py-0.5">{prompt!.category}</span>
            {(prompt!.tags ?? []).map((tag) => (
              <span key={tag} className="rounded bg-muted px-2 py-0.5">{tag}</span>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">System</p>
            <pre className="text-xs font-mono whitespace-pre-wrap rounded border bg-background p-3">{prompt!.systemPrompt}</pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
            <pre className="text-xs font-mono whitespace-pre-wrap rounded border bg-background p-3">{prompt!.userPrompt}</pre>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/prompts/new')}>
            Use as template
          </Button>
        </div>
      ) : (
        <PromptForm
          key={isNew ? 'new' : prompt!.id}
          initial={initial}
          saving={pending}
          submitLabel={isNew ? 'Create prompt' : 'Save'}
          onSubmit={handleSubmit}
        />
      )}

      {!isNew && !isCommunity && (
        <section className="border-t pt-4">
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" loading={remove.isPending} onClick={handleDelete}>
                Delete prompt
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Delete prompt
            </Button>
          )}
        </section>
      )}
    </div>
  )
}
