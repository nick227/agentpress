import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCheckResearchSource, useUpdateResearchSource, useDeleteResearchSource } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ResearchSource = components['schemas']['ResearchSource']

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
  const [youtubeUrl, setYoutubeUrl] = useState(source.youtubeUrl)
  const [category, setCategory] = useState(source.category ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleCheck() {
    try {
      const result = await checkSource.mutateAsync(source.id)
      const r = result.data
      if (!r.checked) {
        toast.error('Could not resolve YouTube channel. Check the URL.')
      } else if (r.newItem) {
        toast.success('New video found and transcript fetched!')
      } else {
        toast('No new videos since last check.')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Check failed')
    }
  }

  async function handleSave() {
    try {
      await updateSource.mutateAsync({ sourceId: source.id, name, youtubeUrl, category: category || undefined })
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

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">{source.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {source.itemCount ?? 0} video{(source.itemCount ?? 0) !== 1 ? 's' : ''} collected
            {source.lastChecked ? ` · Last checked ${new Date(source.lastChecked).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={checkSource.isPending} onClick={handleCheck}>
            <RefreshCw size={13} />
            Check for new video
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
            <label className="block text-xs font-medium mb-1">YouTube URL</label>
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. politics" className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={updateSource.isPending} onClick={handleSave}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-3 mb-6">
          <Row label="YouTube URL">
            <a
              href={source.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-accent hover:underline truncate"
            >
              {source.youtubeUrl}
              <ExternalLink size={11} />
            </a>
          </Row>
          {source.category && (
            <Row label="Category">
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground capitalize">
                {source.category}
              </span>
            </Row>
          )}
          {source.channelId && (
            <Row label="Channel ID">
              <span className="text-sm font-mono text-muted-foreground">{source.channelId}</span>
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
          Summaries are stored here and can be referenced in pipeline runs as <code className="font-mono bg-muted px-1 rounded text-xs">{'{{research}}'}</code> variables (coming soon).
        </p>
        {!confirmDelete ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
            Delete source
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" loading={deleteSource.isPending} onClick={handleDelete}>
              Delete source
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
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
