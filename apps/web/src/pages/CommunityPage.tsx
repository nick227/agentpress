import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Bot, Check, GitFork, Rss, Workflow, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useCommunityAgents, useCommunityFeeds, useCommunityPipelines, useCommunityPrompts, useForkCommunityAgent, useForkCommunityFeed, useForkCommunityPipeline, useForkCommunityPrompt } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Tab = 'pipelines' | 'agents' | 'feeds' | 'prompts'

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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
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

function SectionHeader({ label, first }: { label: string; first: boolean }) {
  return (
    <div className={cn('px-4 py-2 bg-muted/50', !first && 'border-t')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

export function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab: Tab = requestedTab === 'agents' || requestedTab === 'feeds' || requestedTab === 'prompts' ? requestedTab : 'pipelines'
  const [pipelineCat, setPipelineCat] = useState<string | null>(null)
  const [feedCat, setFeedCat] = useState<string | null>(null)
  const [promptKind, setPromptKind] = useState<string | null>(null)

  const pipelines = useCommunityPipelines()
  const agents = useCommunityAgents()
  const feeds = useCommunityFeeds()
  const prompts = useCommunityPrompts()
  const forkPipeline = useForkCommunityPipeline()
  const forkAgent = useForkCommunityAgent()
  const forkFeed = useForkCommunityFeed()
  const forkPrompt = useForkCommunityPrompt()

  const allPipelines = pipelines.data ?? []
  const allAgents = agents.data ?? []
  const allFeeds = feeds.data ?? []
  const allPrompts = prompts.data ?? []

  const pipelineCats = PIPELINE_CATEGORY_ORDER.filter(c => allPipelines.some(p => p.category === c))
  const feedCats = FEED_CATEGORY_ORDER.filter(c => allFeeds.some(f => f.category === c))
  const promptKinds = PROMPT_KIND_ORDER.filter(k => allPrompts.some(p => p.kind === k))

  const filteredPipelines = pipelineCat ? allPipelines.filter(p => p.category === pipelineCat) : allPipelines
  const filteredFeeds = feedCat ? allFeeds.filter(f => f.category === feedCat) : allFeeds
  const filteredPrompts = promptKind ? allPrompts.filter(p => p.kind === promptKind) : allPrompts

  const pipelineGroups = groupBy(filteredPipelines, p => p.category ?? 'other', PIPELINE_CATEGORY_ORDER)
  const feedGroups = groupBy(filteredFeeds, f => f.category ?? 'other', FEED_CATEGORY_ORDER)
  const promptGroups = groupBy(filteredPrompts, p => p.kind ?? 'CONTENT', PROMPT_KIND_ORDER)

  function setTab(next: Tab) {
    setSearchParams(next === 'pipelines' ? {} : { tab: next })
  }

  return (
    <div className="page-shell space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Community</h1>
        <p className="text-sm text-muted-foreground">Public starter resources. Copies and runs stay private in your workspace.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'pipelines' ? 'default' : 'outline'} onClick={() => setTab('pipelines')}><Workflow size={13} /> Pipelines</Button>
        <Button size="sm" variant={tab === 'agents' ? 'default' : 'outline'} onClick={() => setTab('agents')}><Bot size={13} /> Agents</Button>
        <Button size="sm" variant={tab === 'feeds' ? 'default' : 'outline'} onClick={() => setTab('feeds')}><Rss size={13} /> Feeds</Button>
        <Button size="sm" variant={tab === 'prompts' ? 'default' : 'outline'} onClick={() => setTab('prompts')}><BookOpen size={13} /> Prompts</Button>
      </div>

      {tab === 'pipelines' && (
        <>
          {pipelineCats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip label="All" active={!pipelineCat} onClick={() => setPipelineCat(null)} />
              {pipelineCats.map(c => (
                <Chip key={c} label={PIPELINE_CATEGORY_LABELS[c] ?? c} active={pipelineCat === c} onClick={() => setPipelineCat(c === pipelineCat ? null : c)} />
              ))}
            </div>
          )}
          <div className="rounded border bg-surface overflow-hidden">
            {pipelineCat
              ? filteredPipelines.map(p => (
                  <PipelineRow key={p.id} pipeline={p} loading={forkPipeline.isPending} onFork={async () => { await forkPipeline.mutateAsync(p.id); toast.success('Private pipeline copy created') }} />
                ))
              : pipelineGroups.map(([cat, items], gi) => (
                  <div key={cat}>
                    <SectionHeader label={PIPELINE_CATEGORY_LABELS[cat] ?? cat} first={gi === 0} />
                    {items.map(p => (
                      <PipelineRow key={p.id} pipeline={p} loading={forkPipeline.isPending} onFork={async () => { await forkPipeline.mutateAsync(p.id); toast.success('Private pipeline copy created') }} />
                    ))}
                  </div>
                ))}
          </div>
        </>
      )}

      {tab === 'feeds' && (
        <>
          {feedCats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip label="All" active={!feedCat} onClick={() => setFeedCat(null)} />
              {feedCats.map(c => (
                <Chip key={c} label={FEED_CATEGORY_LABELS[c] ?? c} active={feedCat === c} onClick={() => setFeedCat(c === feedCat ? null : c)} />
              ))}
            </div>
          )}
          <div className="rounded border bg-surface overflow-hidden">
            {feedCat
              ? filteredFeeds.map(f => (
                  <FeedRow key={f.id} feed={f} loading={forkFeed.isPending} onFork={async () => { await forkFeed.mutateAsync(f.id); toast.success('Feed added to your sources') }} />
                ))
              : feedGroups.map(([cat, items], gi) => (
                  <div key={cat}>
                    <SectionHeader label={FEED_CATEGORY_LABELS[cat] ?? cat} first={gi === 0} />
                    {items.map(f => (
                      <FeedRow key={f.id} feed={f} loading={forkFeed.isPending} onFork={async () => { await forkFeed.mutateAsync(f.id); toast.success('Feed added to your sources') }} />
                    ))}
                  </div>
                ))}
          </div>
        </>
      )}

      {tab === 'agents' && (
        <div className="rounded border bg-surface overflow-hidden">
          {allAgents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} loading={forkAgent.isPending} onFork={async () => {
              await forkAgent.mutateAsync(agent.id)
              toast.success('Agent added to your library')
            }} />
          ))}
        </div>
      )}

      {tab === 'prompts' && (
        <>
          {promptKinds.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip label="All" active={!promptKind} onClick={() => setPromptKind(null)} />
              {promptKinds.map(k => (
                <Chip key={k} label={PROMPT_KIND_LABELS[k] ?? k} active={promptKind === k} onClick={() => setPromptKind(k === promptKind ? null : k)} />
              ))}
            </div>
          )}
          <div className="rounded border bg-surface overflow-hidden">
            {promptKind
              ? filteredPrompts.map(p => (
                  <PromptRow key={p.id} prompt={p} loading={forkPrompt.isPending} onFork={async () => { await forkPrompt.mutateAsync(p.id); toast.success('Prompt added to your library') }} />
                ))
              : promptGroups.map(([kind, items], gi) => (
                  <div key={kind}>
                    <SectionHeader label={PROMPT_KIND_LABELS[kind] ?? kind} first={gi === 0} />
                    {items.map(p => (
                      <PromptRow key={p.id} prompt={p} loading={forkPrompt.isPending} onFork={async () => { await forkPrompt.mutateAsync(p.id); toast.success('Prompt added to your library') }} />
                    ))}
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  )
}

function PipelineRow({ pipeline, loading, onFork }: { pipeline: any; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link to={`/pipelines/${pipeline.slug || pipeline.id}`} className="text-sm font-medium hover:underline block">{pipeline.name}</Link>
        <p className="text-xs text-muted-foreground truncate">{pipeline.description || `${pipeline._count?.agents ?? 0} agents`}</p>
      </div>
      <Button size="sm" variant="outline" loading={loading} onClick={onFork}><GitFork size={13} /> Use pipeline</Button>
    </div>
  )
}

function AgentRow({ agent, loading, onFork }: { agent: any; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <Bot size={14} className="text-accent" />
      <div className="min-w-0 flex-1">
        <Link to={`/agents/${agent.slug || agent.id}`} className="text-sm font-medium hover:underline block">{agent.name}</Link>
        <p className="text-xs text-muted-foreground truncate">{agent.description ?? agent.kind}</p>
      </div>
      <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add Agent</Button>
    </div>
  )
}

function FeedRow({ feed, loading, onFork }: { feed: any; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link to={`/research/${feed.slug || feed.id}`} className="text-sm font-medium hover:underline block">{feed.name}</Link>
        <p className="text-xs text-muted-foreground capitalize">{feed.sourceType} · {feed._count?.items ?? 0} items</p>
      </div>
      <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add feed</Button>
    </div>
  )
}

function PromptRow({ prompt, loading, onFork }: { prompt: any; loading: boolean; onFork: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link to={`/prompts/${prompt.slug || prompt.id}`} className="text-sm font-medium hover:underline block">{prompt.name}</Link>
        <p className="text-xs text-muted-foreground truncate">{prompt.description}</p>
      </div>
      <Button size="sm" variant="outline" loading={loading} onClick={onFork}><Check size={13} /> Add prompt</Button>
    </div>
  )
}
