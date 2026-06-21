import { useState } from 'react'
import { toast } from 'sonner'
import { X, Search, FlaskConical, PenLine, BarChart2, Pencil, ArrowUpRight, BookOpen } from 'lucide-react'
import {
  appendAgentDefinitionToPipelineInputs,
  libraryAgentToDefinition,
} from '@project/content'
import { useAgents, useUpdatePipeline } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

type Agent = components['schemas']['Agent']
type Pipeline = components['schemas']['Pipeline']

interface Props {
  pipeline: Pipeline
  pipelineId: string
  onClose: () => void
  onAgentAdded: (agentId: string) => void
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'research', label: 'Research', icon: <FlaskConical size={12} /> },
  { id: 'writing', label: 'Writing', icon: <PenLine size={12} /> },
  { id: 'seo', label: 'SEO', icon: <BarChart2 size={12} /> },
  { id: 'editing', label: 'Editing', icon: <Pencil size={12} /> },
  { id: 'pipeline', label: 'Pipeline', icon: <BookOpen size={12} /> },
  { id: 'promoted', label: 'From Runs', icon: <ArrowUpRight size={12} /> },
]

const TARGET_COLORS: Record<string, string> = {
  title: 'bg-blue-100 text-blue-700',
  excerpt: 'bg-purple-100 text-purple-700',
  body: 'bg-green-100 text-green-700',
  thumbnail_prompt: 'bg-orange-100 text-orange-700',
  thumbnail: 'bg-orange-100 text-orange-700',
  image: 'bg-violet-100 text-violet-700',
  custom: 'bg-gray-100 text-gray-600',
}

export function AgentLibraryBrowser({ pipeline, pipelineId, onClose, onAgentAdded }: Props) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)

  const { data, isLoading } = useAgents({
    category: category === 'all' ? undefined : category,
    search: search || undefined,
    resolved: true,
  })
  const update = useUpdatePipeline()

  const agents = data?.data ?? []
  const ownedAgents = agents.filter((agent) => agent.visibility === 'PRIVATE')
  const communityAgents = agents.filter((agent) => agent.visibility === 'PUBLIC')

  async function handleAdd(agent: Agent) {
    setAdding(agent.id)
    try {
      const definition = { ...libraryAgentToDefinition(agent), sourceAgentId: agent.id }
      const result = await update.mutateAsync({
        pipelineId,
        agents: appendAgentDefinitionToPipelineInputs(pipeline.agents, definition),
      })
      const added = result.data.agents[result.data.agents.length - 1]
      toast.success(`"${agent.name}" added to pipeline`)
      if (added) onAgentAdded(added.id)
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add agent')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Agent Library</h2>
              <p className="text-xs text-muted-foreground">
                {agents.length} Agent{agents.length !== 1 ? 's' : ''} · definitions copy on insert, no live link
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>

        {/* Search + category tabs */}
        <div className="px-5 pt-3 pb-2 border-b shrink-0 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  category === cat.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : agents.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? `No agents match "${search}"` : 'No agents in this category yet'}
            </div>
          ) : (
            <>
              {ownedAgents.length > 0 && <AgentGroup label="Your Agents" agents={ownedAgents} adding={adding} onAdd={handleAdd} />}
              {communityAgents.length > 0 && <AgentGroup label="Community Agents" agents={communityAgents} adding={adding} onAdd={handleAdd} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentGroup({ label, agents, adding, onAdd }: { label: string; agents: Agent[]; adding: string | null; onAdd: (agent: Agent) => void }) {
  return (
    <section className="space-y-2">
      <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {agents.map((agent) => <AgentCard key={agent.id} agent={agent} isAdding={adding === agent.id} onAdd={() => onAdd(agent)} />)}
    </section>
  )
}

function AgentCard({
  agent,
  isAdding,
  onAdd,
}: {
  agent: Agent
  isAdding: boolean
  onAdd: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const outputTarget = agent.outputTarget ?? 'body'
  const targetColor = TARGET_COLORS[outputTarget] ?? TARGET_COLORS.custom!

  return (
    <div className="border rounded-lg p-3.5 space-y-2 hover:border-muted-foreground/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{agent.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${targetColor}`}>
              {outputTarget}
            </span>
            {agent.usageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                used {agent.usageCount}×
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {agent.description}
            </p>
          )}
        </div>
        <Button size="sm" loading={isAdding} onClick={onAdd} className="shrink-0">
          Add
        </Button>
      </div>

      {(agent.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(agent.tags ?? []).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? 'Hide prompts ↑' : 'Preview prompts ↓'}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          <PromptPreview label="System" content={agent.systemPrompt} />
          <PromptPreview label="User" content={agent.userPrompt} />
        </div>
      )}
    </div>
  )
}

function PromptPreview({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label} prompt</p>
      <pre className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/30 rounded p-2.5 max-h-32 overflow-y-auto font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  )
}
