import { useEffect, useState } from 'react'
import { ChevronLeft, ExternalLink, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useCreateDestination, useDeleteDestination, useDestination, useUpdateDestination, useWordPressCategories } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

type FormState = {
  name: string
  siteUrl: string
  username: string
  secret: string
  defaultStatus: 'draft' | 'publish'
  defaultCategoryIds: number[]
}

const EMPTY_FORM: FormState = {
  name: '',
  siteUrl: '',
  username: '',
  secret: '',
  defaultStatus: 'draft',
  defaultCategoryIds: [],
}

export function DestinationEditorPage() {
  const { destinationId = 'new' } = useParams<{ destinationId: string }>()
  const isNew = destinationId === 'new'
  const navigate = useNavigate()
  const { data: destinationData, isLoading: destinationLoading } = useDestination(isNew ? '' : destinationId)
  const destination = destinationData?.data
  const { data: categoryData, isLoading: categoriesLoading, error: categoriesError } = useWordPressCategories(isNew ? undefined : destinationId)
  const create = useCreateDestination()
  const update = useUpdateDestination()
  const remove = useDeleteDestination()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY_FORM))
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!destination) return
    const next: FormState = {
      name: destination.name,
      siteUrl: destination.siteUrl,
      username: destination.username ?? '',
      secret: '',
      defaultStatus: destination.defaultStatus,
      defaultCategoryIds: destination.defaultCategoryIds ?? [],
    }
    setForm(next)
    setBaseline(JSON.stringify(next))
  }, [destination])

  const dirty = JSON.stringify(form) !== baseline
  const requiredComplete = Boolean(form.name.trim() && form.siteUrl.trim() && form.username.trim() && (!isNew || form.secret.trim()))
  const pending = create.isPending || update.isPending

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleCategory(categoryId: number) {
    patch('defaultCategoryIds', form.defaultCategoryIds.includes(categoryId)
      ? form.defaultCategoryIds.filter((id) => id !== categoryId)
      : [...form.defaultCategoryIds, categoryId])
  }

  async function handleSave() {
    try {
      if (isNew) {
        const result = await create.mutateAsync({
          name: form.name.trim(),
          siteUrl: form.siteUrl.trim(),
          username: form.username.trim(),
          secret: form.secret.trim(),
          defaultStatus: form.defaultStatus,
        })
        toast.success('Destination created')
        navigate(`/destinations/${result.data.id}`, { replace: true })
      } else {
        await update.mutateAsync({
          destinationId,
          name: form.name.trim(),
          siteUrl: form.siteUrl.trim(),
          username: form.username.trim(),
          ...(form.secret.trim() ? { secret: form.secret.trim() } : {}),
          defaultStatus: form.defaultStatus,
          defaultCategoryIds: form.defaultCategoryIds.length ? form.defaultCategoryIds : null,
        })
        const next = { ...form, secret: '' }
        setForm(next)
        setBaseline(JSON.stringify(next))
        toast.success('Destination saved')
      }
    } catch (error: any) {
      toast.error(error.message ?? 'Could not save destination')
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(destinationId)
      toast.success('Destination deleted')
      navigate('/', { replace: true })
    } catch (error: any) {
      toast.error(error.message ?? 'Could not delete destination')
    }
  }

  if (!isNew && destinationLoading) return <div className="page-shell page-shell--5xl"><Skeleton className="h-64 w-full" /></div>
  if (!isNew && !destination) return <div className="page-shell">Destination not found.</div>

  return (
    <div className="page-shell page-shell--5xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={14} /> Home</Link>
      <div className="page-header gap-4">
        <div className="min-w-0"><h1 className="text-lg font-semibold">{isNew ? 'New destination' : destination?.name}</h1><p className="text-sm text-muted-foreground">WordPress publishing connection and defaults.</p></div>
        <div className="page-header-actions">
          <Button size="sm" loading={pending} disabled={!dirty || !requiredComplete || pending} onClick={handleSave}>{isNew ? 'Create destination' : 'Save'}</Button>
        </div>
      </div>

      <section className="rounded border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Connection</h2>
        <Field label="Name"><Input value={form.name} onChange={(event) => patch('name', event.target.value)} placeholder="My WordPress site" /></Field>
        <Field label="Site URL"><div className="flex gap-2"><Input value={form.siteUrl} onChange={(event) => patch('siteUrl', event.target.value)} placeholder="https://example.com" />{form.siteUrl && <a href={form.siteUrl} target="_blank" rel="noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded border text-muted-foreground hover:text-foreground"><ExternalLink size={13} /></a>}</div></Field>
        <Field label="WordPress username"><Input value={form.username} onChange={(event) => patch('username', event.target.value)} /></Field>
        <Field label={isNew ? 'Application password' : 'New application password (optional)'}><Input type="password" value={form.secret} onChange={(event) => patch('secret', event.target.value)} placeholder={isNew ? 'Required' : 'Leave blank to keep the existing password'} /></Field>
      </section>

      <section className="rounded border p-4 space-y-4">
        <div><h2 className="text-sm font-semibold">Publishing defaults</h2><p className="text-xs text-muted-foreground">Pipelines can override these settings.</p></div>
        <Field label="Default post status"><div className="flex gap-3">{(['draft', 'publish'] as const).map((status) => <label key={status} className="flex items-center gap-1.5 text-sm"><input type="radio" checked={form.defaultStatus === status} onChange={() => patch('defaultStatus', status)} />{status === 'draft' ? 'Draft' : 'Publish live'}</label>)}</div></Field>
        {!isNew && <Field label="Default categories">
          {categoriesLoading ? <Skeleton className="h-10 w-full" /> : categoriesError ? <p className="text-xs text-destructive">Could not load categories. Verify the URL and credentials, save, then try again.</p> : (categoryData?.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No WordPress categories found.</p> : <div className="flex flex-wrap gap-2">{categoryData!.data.map((category) => <label key={category.id} className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${form.defaultCategoryIds.includes(category.id) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><input type="checkbox" checked={form.defaultCategoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />{category.name}</label>)}</div>}
        </Field>}
      </section>

      {!isNew && <section className="border-t pt-4">{confirmDelete ? <div className="flex gap-2"><Button variant="destructive" size="sm" loading={remove.isPending} onClick={handleDelete}>Delete destination</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button></div> : <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete destination</Button>}</section>}
    </div>
  )
}

