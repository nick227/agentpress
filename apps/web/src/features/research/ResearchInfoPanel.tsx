import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCheckResearchSource, useUpdateResearchSource, useDeleteResearchSource } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { researchCheckFeedback } from './researchCheckFeedback'

type ResearchSource = components['schemas']['ResearchSource']

const TYPE_LABELS: Record<string, { urlLabel: string; externalIdLabel: string; checkLabel: string; newLabel: (n: number) => string; updatedLabel: (n: number) => string; noNewLabel: string }> = {
  youtube: {
    urlLabel: 'YouTube URL',
    externalIdLabel: 'Channel ID',
    checkLabel: 'Check for new video',
    newLabel: () => 'New video found and transcript fetched!',
    updatedLabel: () => 'Video content refreshed.',
    noNewLabel: 'No new videos since last check.',
  },
  reddit: {
    urlLabel: 'Subreddit URL',
    externalIdLabel: 'Subreddit',
    checkLabel: "Fetch today's posts",
    newLabel: (n) => `${n} new digest${n !== 1 ? 's' : ''} fetched!`,
    updatedLabel: (n) => `${n} digest${n !== 1 ? 's' : ''} refreshed.`,
    noNewLabel: "Already have today's digest.",
  },
  rss: {
    urlLabel: 'Feed URL',
    externalIdLabel: 'Feed URL',
    checkLabel: 'Fetch latest articles',
    newLabel: (n) => `${n} new article${n !== 1 ? 's' : ''} fetched!`,
    updatedLabel: (n) => `${n} article${n !== 1 ? 's' : ''} refreshed.`,
    noNewLabel: 'No new articles since last check.',
  },
}

interface Props {
  source: ResearchSource
  accountSlug: string
}

export function ResearchInfoPanel({ source, accountSlug }: Props) {
  const navigate = useNavigate()
  const checkSource = useCheckResearchSource()
  const updateSource = useUpdateResearchSource()
  const deleteSource = useDeleteResearchSource()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(source.name)
  const [sourceUrl, setSourceUrl] = useState(source.sourceUrl)
  const [category, setCategory] = useState(source.category ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const labels = TYPE_LABELS[source.sourceType] ?? TYPE_LABELS.youtube!

  async function handleCheck() {
    const loadingId = toast.loading(
      source.sourceType === 'youtube' ? 'Checking for latest video and fetching transcript…' : 'Checking for new content…',
    )
    try {
      const result = await checkSource.mutateAsync(source.id)
      const feedback = researchCheckFeedback(source.sourceType, result.data, labels)
      toast.dismiss(loadingId)
      if (feedback.variant === 'success') toast.success(feedback.message)
      else if (feedback.variant === 'error') toast.error(feedback.message)
      else toast.info(feedback.message)
    } catch (err: unknown) {
      toast.dismiss(loadingId)
      toast.error(err instanceof Error ? err.message : 'Check failed')
    }
  }

  async function handleSave() {
    try {
      await updateSource.mutateAsync({ sourceId: source.id, name, sourceUrl, category: category || undefined })
      toast.success('Source updated')
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Update failed')
    }
  }

  async function handleDelete() {
    try {
      await deleteSource.mutateAsync(source.id)
      toast.success('Source deleted')
      navigate(`/accounts/${accountSlug}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Delete failed')
    }
  }

  const itemWord = source.sourceType === 'youtube' ? 'video' : source.sourceType === 'reddit' ? 'digest' : 'article'

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">{source.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {source.itemCount ?? 0} {itemWord}{(source.itemCount ?? 0) !== 1 ? 's' : ''} collected
            {source.lastChecked ? ` · Last checked ${new Date(source.lastChecked).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={checkSource.isPending} onClick={handleCheck}>
            <RefreshCw size={13} />
            {labels.checkLabel}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing((v) => !v)}>
            <Pencil size={13} />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="border rounded-lg p-4 space-y-3 mb-6">
          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{labels.urlLabel}</label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. financial" className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={updateSource.isPending} onClick={handleSave}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-3 mb-6">
          <Row label={labels.urlLabel}>
            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-accent hover:underline truncate">
              {source.sourceUrl}
              <ExternalLink size={11} />
            </a>
          </Row>
          <Row label="Type">
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground capitalize">
              {source.sourceType}
            </span>
          </Row>
          {source.category && (
            <Row label="Category">
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground capitalize">
                {source.category}
              </span>
            </Row>
          )}
          {source.externalId && (
            <Row label={labels.externalIdLabel}>
              <span className="text-sm font-mono text-muted-foreground">{source.externalId}</span>
            </Row>
          )}
          <Row label="Status">
            <StatusBadge status={source.status} />
          </Row>
          <Row label="Created">
            <span className="text-sm text-muted-foreground">
              {new Date(source.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </Row>
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-xs text-muted-foreground mb-3">
          Reference this feed's latest summary as <code className="font-mono bg-muted px-1 rounded text-xs">{`{${source.slug}.summary}`}</code>. Open an item to use a date-pinned reference.
        </p>
        {!confirmDelete ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
            Delete source
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" loading={deleteSource.isPending} onClick={handleDelete}>Delete source</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    paused: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  )
}
