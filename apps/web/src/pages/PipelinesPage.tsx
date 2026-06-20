import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import { usePipelines, useDeletePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { CreatePipelineDialog } from '@/features/pipelines/CreatePipelineDialog'
import { PipelineStatusBadge } from '@/features/pipelines/PipelineStatusBadge'
import { TemplateBrowser } from '@/features/content/TemplateBrowser'

export function PipelinesPage() {
  const navigate = useNavigate()
  const { data, isLoading } = usePipelines()
  const deletePipeline = useDeletePipeline()
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const pipelines = (data?.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">Pipelines</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplateBrowser(true)}>From Template</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Pipeline
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pipelines…" className="max-w-xs" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : pipelines.length === 0 ? (
        <EmptyState icon={Workflow} title="No pipelines yet" description="Create your first pipeline to start building AI workflows." action={{ label: 'New Pipeline', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1.5">
          {pipelines.map((pipeline) => {
            const isConfirming = confirmDeleteId === pipeline.id
            return (
              <div key={pipeline.id} className="flex items-center rounded border bg-surface hover:bg-muted/40 transition-colors group">
                <button type="button" onClick={() => navigate(`/pipelines/${pipeline.slug}`)} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{pipeline.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pipeline.agentCount} {pipeline.agentCount === 1 ? 'agent' : 'agents'}
                      {pipeline.lastRunAt ? ` · Last run ${new Date(pipeline.lastRunAt).toLocaleDateString()}` : ' · No runs yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pipeline.category && <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground capitalize">{pipeline.category}</span>}
                    <PipelineStatusBadge status={pipeline.status} />
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1 pr-2">
                  {isConfirming ? (
                    <>
                      <Button variant="destructive" size="sm" loading={deletePipeline.isPending} onClick={async () => { await deletePipeline.mutateAsync(pipeline.id); setConfirmDeleteId(null) }}>Delete</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(pipeline.id)}>✕</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreatePipelineDialog onClose={() => setShowCreate(false)} />}
      {showTemplateBrowser && <TemplateBrowser onClose={() => setShowTemplateBrowser(false)} />}
    </div>
  )
}
