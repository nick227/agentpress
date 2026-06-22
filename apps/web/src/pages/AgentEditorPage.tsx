import { useState } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAgent, useCreateAgent, useDeleteAgent, useUpdateAgent } from '@project/sdk'
import { AgentForm, agentToFormValues, type AgentFormValues } from '@/features/agents/AgentForm'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

export function AgentEditorPage() {
  const { agentId = 'new' } = useParams()
  const isNew = agentId === 'new'
  const navigate = useNavigate()
  const query = useAgent(isNew ? '' : agentId)
  const create = useCreateAgent()
  const update = useUpdateAgent()
  const remove = useDeleteAgent()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const agent = query.data?.data
  if (!isNew && query.isLoading) return <div className="page-shell"><Skeleton className="h-64" /></div>
  if (!isNew && !agent) return <div className="page-shell">Agent not found.</div>

  const isCommunity = agent?.visibility === 'PUBLIC'

  async function save(values: AgentFormValues) {
    try {
      if (isNew) {
        const result = await create.mutateAsync(values)
        navigate(`/agents/${result.data.slug}`, { replace: true })
      } else {
        const { sourceAgentId: _sourceAgentId, ...editable } = values
        await update.mutateAsync({ agentId: agent!.id, ...editable })
      }
      toast.success('Agent saved')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save Agent') }
  }

  return (
    <div className="page-shell page-shell--5xl space-y-6">
      <Link to={isCommunity ? "/community?tab=agents" : "/agents"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> {isCommunity ? 'Community' : 'Agents'}
      </Link>
      <div><h1 className="text-lg font-semibold">{isNew ? 'New Agent' : agent!.name}</h1><p className="text-sm text-muted-foreground">{isCommunity ? 'Community agent — read-only template from the catalog.' : 'Reusable definition; existing pipeline snapshots are never changed.'}</p></div>
      {isCommunity ? (
        <div className="rounded border p-4 space-y-4 bg-muted/10">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-0.5">{agent!.kind}</span>
            <span className="rounded bg-muted px-2 py-0.5">{agent!.category}</span>
            {(agent!.tags ?? []).map((tag: string) => (
              <span key={tag} className="rounded bg-muted px-2 py-0.5">{tag}</span>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">System prompt</p>
            <pre className="text-xs font-mono whitespace-pre-wrap rounded border bg-background p-3">{agent!.systemPrompt || 'None'}</pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">User prompt</p>
            <pre className="text-xs font-mono whitespace-pre-wrap rounded border bg-background p-3">{agent!.userPrompt}</pre>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/agents/new')}>Use as template</Button>
        </div>
      ) : (
        <AgentForm key={agent?.id ?? 'new'} initial={agent ? agentToFormValues(agent) : undefined} saving={create.isPending || update.isPending} onSubmit={save} />
      )}
      {!isNew && !isCommunity && (confirmDelete ? <div className="flex gap-2"><Button variant="destructive" size="sm" onClick={async () => { await remove.mutateAsync(agent!.id); navigate('/agents') }}>Delete Agent</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button></div> : <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete Agent</Button>)}
    </div>
  )
}
