import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Bot, Check, GitFork, Layers, Rss, Workflow, BookOpen, X } from 'lucide-react'
import {
  useCommunityAgents,
  useCommunityFeeds,
  useCommunityPipelines,
  useCommunityPrompts,
  useCommunityWorkflows,
  useForkCommunityAgent,
  useForkCommunityFeed,
  useForkCommunityPipeline,
  useForkCommunityPrompt,
  useForkCommunityWorkflow,
} from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

export type CommunityTab = 'pipelines' | 'workflows' | 'agents' | 'feeds' | 'prompts'

interface Props {
  defaultTab?: CommunityTab
  onClose: () => void
}

// ─── Category / ordering helpers ─────────────────────────────────────────────

const PIPELINE_CATEGORY_LABELS: Record<string, string> = {
  financial: 'Financial',
  ai: 'AI & Tech',
  politics: 'Politics',
  content: 'Content',
}
const PIPELINE_CATEGORY_ORDER = ['financial', 'ai', 'politics', 'content']

const FEED_CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI & Machine Learning',
  financial: 'Financial Markets',
  tech: 'Tech & Development',
  politics: 'Politics & News',
  culture: 'Culture',
}
const FEED_CATEGORY_ORDER = ['ai', 'financial', 'tech', 'politics', 'culture']

const PROMPT_KIND_LABELS: Record<string, string> = {
  CONTENT: 'Research Summaries',
  TRANSFORMATIONAL: 'Reusable Prompts',
}
const PROMPT_KIND_ORDER = ['CONTENT', 'TRANSFORMATIONAL']

const WORKFLOW_CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  writing: 'Writing',
  seo: 'SEO',
  finance: 'Finance',
  newsletter: 'Newsletter',
  social: 'Social',
  news: 'News',
  video: 'Video',
  general: 'General',
}
const WORKFLOW_CATEGORY_ORDER = [
  'research', 'writing', 'seo', 'finance', 'newsletter', 'social', 'news', 'video',
]

function groupBy<T>(items: T[], key: (item: T) => string, order?: string[]): [string, T[]][] {
  const map: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    ;(map[k] ??= []).push(item)
  }
  const entries = Object.entries(map)
  if (order) {
    entries.sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }
  return entries
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-surface text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function SectionLabel({ label, first }: { label: string; first: boolean }) {
  return (
    <div className={cn('px-4 py-2 bg-muted/50', !first && 'border-t')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function AddedBadge() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-600/25 dark:border-emerald-400/25 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 shrink-0">
      <Check size={12} />
      Added
    </div>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-px p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

// ─── Row components ───────────────────────────────────────────────────────────

function PipelineRow({
  pipeline, added, loading, onFork,
}: { pipeline: any; added: boolean; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link to={`/pipelines/${pipeline.slug || pipeline.id}`} className="text-sm font-medium hover:underline block">
          {pipeline.name}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          {pipeline.description || `${pipeline._count?.agents ?? 0} agents`}
        </p>
      </div>
      {added
        ? <AddedBadge />
        : <Button size="sm" variant="outline" loading={loading} onClick={onFork}><GitFork size={13} /> Use pipeline</Button>
      }
    </div>
  )
}

function AgentRow({
  agent, added, loading, onFork,
}: { agent: any; added: boolean; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <Bot size={14} className="text-accent shrink-0" />
      <div className="min-w-0 flex-1">
        <Link to={`/agents/${agent.slug || agent.id}`} className="text-sm font-medium hover:underline block">
          {agent.name}
        </Link>
        <p className="text-xs text-muted-foreground truncate">{agent.description ?? agent.kind}</p>
      </div>
      {added
        ? <AddedBadge />
        : <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add agent</Button>
      }
    </div>
  )
}

function FeedRow({
  feed, added, loading, onFork,
}: { feed: any; added: boolean; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <Rss size={14} className="text-amber-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <Link to={`/research/${feed.slug || feed.id}`} className="text-sm font-medium hover:underline block">
          {feed.name}
        </Link>
        <p className="text-xs text-muted-foreground capitalize">
          {feed.sourceType} · {feed._count?.items ?? 0} items
        </p>
      </div>
      {added
        ? <AddedBadge />
        : <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add feed</Button>
      }
    </div>
  )
}

function PromptRow({
  prompt, added, loading, onFork,
}: { prompt: any; added: boolean; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link to={`/prompts/${prompt.slug || prompt.id}`} className="text-sm font-medium hover:underline block">
          {prompt.name}
        </Link>
        <p className="text-xs text-muted-foreground truncate">{prompt.description}</p>
      </div>
      {added
        ? <AddedBadge />
        : <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add prompt</Button>
      }
    </div>
  )
}

function WorkflowRow({
  workflow, added, loading, onFork,
}: { workflow: any; added: boolean; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <Layers size={14} className="text-accent shrink-0" />
      <div className="min-w-0 flex-1">
        <Link to={`/workflows/${workflow.id}`} className="text-sm font-medium hover:underline block">
          {workflow.name}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          {workflow.description || `${workflow.nodeCount ?? 0} nodes`}
        </p>
      </div>
      {added
        ? <AddedBadge />
        : <Button size="sm" variant="outline" loading={loading} onClick={onFork}><GitFork size={13} /> Fork workflow</Button>
      }
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const TAB_CONFIG: Array<{ id: CommunityTab; label: string; icon: React.ReactNode }> = [
  { id: 'pipelines', label: 'Pipelines', icon: <Workflow size={13} /> },
  { id: 'workflows', label: 'Workflows', icon: <Layers size={13} /> },
  { id: 'agents',    label: 'Agents',    icon: <Bot size={13} /> },
  { id: 'feeds',     label: 'Feeds',     icon: <Rss size={13} /> },
  { id: 'prompts',   label: 'Prompts',   icon: <BookOpen size={13} /> },
]

export function CommunityBrowser({ defaultTab = 'pipelines', onClose }: Props) {
  const [tab, setTab] = useState<CommunityTab>(defaultTab)

  const [pipelineCat, setPipelineCat] = useState<string | null>(null)
  const [feedCat, setFeedCat] = useState<string | null>(null)
  const [promptKind, setPromptKind] = useState<string | null>(null)
  const [workflowCat, setWorkflowCat] = useState<string | null>(null)

  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const pipelines = useCommunityPipelines()
  const agents = useCommunityAgents()
  const feeds = useCommunityFeeds()
  const prompts = useCommunityPrompts()
  const workflows = useCommunityWorkflows()

  const forkPipeline = useForkCommunityPipeline()
  const forkAgent = useForkCommunityAgent()
  const forkFeed = useForkCommunityFeed()
  const forkPrompt = useForkCommunityPrompt()
  const forkWorkflow = useForkCommunityWorkflow()

  const allPipelines = pipelines.data ?? []
  const allAgents = agents.data ?? []
  const allFeeds = feeds.data ?? []
  const allPrompts = prompts.data ?? []
  const allWorkflows = workflows.data?.data ?? []

  function isAdded(item: any) {
    return item.forked === true || addedIds.has(item.id)
  }

  async function handleFork(id: string, mutate: (id: string) => Promise<unknown>, successMsg: string) {
    setPendingId(id)
    try {
      await mutate(id)
      setAddedIds((prev) => new Set([...prev, id]))
      toast.success(successMsg)
    } catch {
      toast.error('Failed to add — please try again')
    } finally {
      setPendingId(null)
    }
  }

  function changeTab(next: CommunityTab) {
    setTab(next)
    setPipelineCat(null)
    setFeedCat(null)
    setPromptKind(null)
    setWorkflowCat(null)
  }

  // derived
  const pipelineCats = PIPELINE_CATEGORY_ORDER.filter((c) => allPipelines.some((p) => p.category === c))
  const feedCats = FEED_CATEGORY_ORDER.filter((c) => allFeeds.some((f) => f.category === c))
  const promptKinds = PROMPT_KIND_ORDER.filter((k) => allPrompts.some((p) => p.kind === k))
  const workflowCats = WORKFLOW_CATEGORY_ORDER.filter((c) => allWorkflows.some((w) => w.category === c))

  const filteredPipelines = pipelineCat ? allPipelines.filter((p) => p.category === pipelineCat) : allPipelines
  const filteredFeeds = feedCat ? allFeeds.filter((f) => f.category === feedCat) : allFeeds
  const filteredPrompts = promptKind ? allPrompts.filter((p) => p.kind === promptKind) : allPrompts
  const filteredWorkflows = workflowCat ? allWorkflows.filter((w) => w.category === workflowCat) : allWorkflows

  const pipelineGroups = groupBy(filteredPipelines, (p) => p.category ?? 'other', PIPELINE_CATEGORY_ORDER)
  const feedGroups = groupBy(filteredFeeds, (f) => f.category ?? 'other', FEED_CATEGORY_ORDER)
  const promptGroups = groupBy(filteredPrompts, (p) => p.kind ?? 'CONTENT', PROMPT_KIND_ORDER)
  const workflowGroups = groupBy(filteredWorkflows, (w) => w.category ?? 'general', WORKFLOW_CATEGORY_ORDER)

  const isCurrentLoading = (
    (tab === 'pipelines' && pipelines.isLoading) ||
    (tab === 'workflows' && workflows.isLoading) ||
    (tab === 'agents' && agents.isLoading) ||
    (tab === 'feeds' && feeds.isLoading) ||
    (tab === 'prompts' && prompts.isLoading)
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-lg border w-full max-w-3xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Browse Community</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Public starter resources — copies stay private in your workspace
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="px-5 border-b shrink-0 flex gap-0 overflow-x-auto scrollbar-none">
          {TAB_CONFIG.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Filter chips — per-tab */}
        {tab === 'pipelines' && pipelineCats.length > 1 && (
          <div className="px-5 py-2.5 border-b shrink-0 flex flex-wrap gap-1.5">
            <Chip label="All" active={!pipelineCat} onClick={() => setPipelineCat(null)} />
            {pipelineCats.map((c) => (
              <Chip key={c} label={PIPELINE_CATEGORY_LABELS[c] ?? c} active={pipelineCat === c} onClick={() => setPipelineCat(c === pipelineCat ? null : c)} />
            ))}
          </div>
        )}
        {tab === 'feeds' && feedCats.length > 1 && (
          <div className="px-5 py-2.5 border-b shrink-0 flex flex-wrap gap-1.5">
            <Chip label="All" active={!feedCat} onClick={() => setFeedCat(null)} />
            {feedCats.map((c) => (
              <Chip key={c} label={FEED_CATEGORY_LABELS[c] ?? c} active={feedCat === c} onClick={() => setFeedCat(c === feedCat ? null : c)} />
            ))}
          </div>
        )}
        {tab === 'prompts' && promptKinds.length > 1 && (
          <div className="px-5 py-2.5 border-b shrink-0 flex flex-wrap gap-1.5">
            <Chip label="All" active={!promptKind} onClick={() => setPromptKind(null)} />
            {promptKinds.map((k) => (
              <Chip key={k} label={PROMPT_KIND_LABELS[k] ?? k} active={promptKind === k} onClick={() => setPromptKind(k === promptKind ? null : k)} />
            ))}
          </div>
        )}
        {tab === 'workflows' && workflowCats.length > 1 && (
          <div className="px-5 py-2.5 border-b shrink-0 flex flex-wrap gap-1.5">
            <Chip label="All" active={!workflowCat} onClick={() => setWorkflowCat(null)} />
            {workflowCats.map((c) => (
              <Chip key={c} label={WORKFLOW_CATEGORY_LABELS[c] ?? c} active={workflowCat === c} onClick={() => setWorkflowCat(c === workflowCat ? null : c)} />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {isCurrentLoading ? (
            <LoadingRows />
          ) : (
            <div className="rounded overflow-hidden">
              {tab === 'pipelines' && (
                allPipelines.length === 0
                  ? <EmptyTabState message="No community pipelines available yet." />
                  : pipelineCat
                    ? filteredPipelines.map((p) => (
                        <PipelineRow key={p.id} pipeline={p} added={isAdded(p)} loading={pendingId === p.id} onFork={() => handleFork(p.id, forkPipeline.mutateAsync, 'Private pipeline copy created')} />
                      ))
                    : pipelineGroups.map(([cat, items], gi) => (
                        <div key={cat}>
                          <SectionLabel label={PIPELINE_CATEGORY_LABELS[cat] ?? cat} first={gi === 0} />
                          {items.map((p) => (
                            <PipelineRow key={p.id} pipeline={p} added={isAdded(p)} loading={pendingId === p.id} onFork={() => handleFork(p.id, forkPipeline.mutateAsync, 'Private pipeline copy created')} />
                          ))}
                        </div>
                      ))
              )}

              {tab === 'workflows' && (
                allWorkflows.length === 0
                  ? <EmptyTabState message="No community workflows available yet." />
                  : workflowCat
                    ? filteredWorkflows.map((w) => (
                        <WorkflowRow key={w.id} workflow={w} added={isAdded(w)} loading={pendingId === w.id} onFork={() => handleFork(w.id, (id) => forkWorkflow.mutateAsync({ workflowId: id }), 'Workflow added to your library')} />
                      ))
                    : workflowGroups.map(([cat, items], gi) => (
                        <div key={cat}>
                          <SectionLabel label={WORKFLOW_CATEGORY_LABELS[cat] ?? cat} first={gi === 0} />
                          {items.map((w) => (
                            <WorkflowRow key={w.id} workflow={w} added={isAdded(w)} loading={pendingId === w.id} onFork={() => handleFork(w.id, (id) => forkWorkflow.mutateAsync({ workflowId: id }), 'Workflow added to your library')} />
                          ))}
                        </div>
                      ))
              )}

              {tab === 'agents' && (
                allAgents.length === 0
                  ? <EmptyTabState message="No community agents available yet." />
                  : allAgents.map((agent) => (
                      <AgentRow key={agent.id} agent={agent} added={isAdded(agent)} loading={pendingId === agent.id} onFork={() => handleFork(agent.id, forkAgent.mutateAsync, 'Agent added to your library')} />
                    ))
              )}

              {tab === 'feeds' && (
                allFeeds.length === 0
                  ? <EmptyTabState message="No community feeds available yet." />
                  : feedCat
                    ? filteredFeeds.map((f) => (
                        <FeedRow key={f.id} feed={f} added={isAdded(f)} loading={pendingId === f.id} onFork={() => handleFork(f.id, forkFeed.mutateAsync, 'Feed added to your sources')} />
                      ))
                    : feedGroups.map(([cat, items], gi) => (
                        <div key={cat}>
                          <SectionLabel label={FEED_CATEGORY_LABELS[cat] ?? cat} first={gi === 0} />
                          {items.map((f) => (
                            <FeedRow key={f.id} feed={f} added={isAdded(f)} loading={pendingId === f.id} onFork={() => handleFork(f.id, forkFeed.mutateAsync, 'Feed added to your sources')} />
                          ))}
                        </div>
                      ))
              )}

              {tab === 'prompts' && (
                allPrompts.length === 0
                  ? <EmptyTabState message="No community prompts available yet." />
                  : promptKind
                    ? filteredPrompts.map((p) => (
                        <PromptRow key={p.id} prompt={p} added={isAdded(p)} loading={pendingId === p.id} onFork={() => handleFork(p.id, forkPrompt.mutateAsync, 'Prompt added to your library')} />
                      ))
                    : promptGroups.map(([kind, items], gi) => (
                        <div key={kind}>
                          <SectionLabel label={PROMPT_KIND_LABELS[kind] ?? kind} first={gi === 0} />
                          {items.map((p) => (
                            <PromptRow key={p.id} prompt={p} added={isAdded(p)} loading={pendingId === p.id} onFork={() => handleFork(p.id, forkPrompt.mutateAsync, 'Prompt added to your library')} />
                          ))}
                        </div>
                      ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
