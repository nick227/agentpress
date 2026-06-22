import { useState } from 'react'
import { Bot, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAgents, useDeleteAgent } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { RowDeleteControls, useDeleteConfirm } from '@/components/ui/RowDeleteControls'
import { CommunityBrowser } from '@/features/content/CommunityBrowser'

export function AgentsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useAgents()
  const deleteAgent = useDeleteAgent()
  const { propsFor } = useDeleteConfirm(deleteAgent)
  const [showCommunity, setShowCommunity] = useState(false)
  const agents = data?.data ?? []

  if (isLoading) return <div className="page-shell"><Skeleton className="h-64" /></div>

  return (
    <div className="page-shell space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">Reusable Agent definitions owned by this workspace.</p>
        </div>
        <div className="page-header-actions">
          <Button size="sm" variant="outline" onClick={() => setShowCommunity(true)}>
            Browse Community
          </Button>
          <Button size="sm" onClick={() => navigate('/agents/new')}>
            <Plus size={13} /> New Agent
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No Agents yet"
          description="Save an Agent from a pipeline or browse community agents to get started."
          action={{ label: 'Browse Community', onClick: () => setShowCommunity(true) }}
        />
      ) : (
        <div className="divide-y rounded border bg-surface">
          {agents.map((agent) => (
            <div key={agent.id} className="group flex items-center hover:bg-muted/30 transition-colors">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                onClick={() => navigate(`/agents/${agent.slug}`)}
              >
                <Bot size={14} className="text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{agent.description ?? agent.defaultUid}</span>
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium">{agent.kind.replaceAll('_', ' ')}</span>
              </button>
              <RowDeleteControls {...propsFor(agent.id, agent.name)} />
            </div>
          ))}
        </div>
      )}

      {showCommunity && <CommunityBrowser defaultTab="agents" onClose={() => setShowCommunity(false)} />}
    </div>
  )
}
