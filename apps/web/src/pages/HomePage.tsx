import { ArrowRight, BookOpen, Check, Clock3, Database, FileText, FlaskConical, GitFork, Rss, Youtube } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCommunityPipelines, useForkCommunityPipeline } from '@project/sdk'

const starters = [
  {
    slug: 'this-week-in-ai',
    icon: FlaskConical,
    name: 'This Week in AI',
    description: 'Turns AI and technology source summaries into a structured weekly roundup.',
  },
  {
    slug: 'daily-market-brief',
    icon: Database,
    name: 'Daily Market Brief',
    description: 'Combines finance videos, Reddit discussions, and news feeds into a market brief.',
  },
  {
    slug: 'political-commentary',
    icon: FileText,
    name: 'Political Commentary',
    description: 'Uses current political source material to draft an edited commentary post.',
  },
] as const

export function HomePage() {
  const navigate = useNavigate()
  const community = useCommunityPipelines()
  const forkPipeline = useForkCommunityPipeline()
  const pipelines = community.data ?? []

  async function useStarter(slug: string) {
    const pipeline = pipelines.find((item) => item.slug === slug)
    if (!pipeline) return
    try {
      const copy = await forkPipeline.mutateAsync(pipeline.id)
      toast.success(`${pipeline.name} copied to your workspace`)
      navigate(`/pipelines/${copy.slug}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Could not copy pipeline')
    }
  }

  return (
    <div className="relative isolate min-h-full overflow-hidden bg-background">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16">
        <div className="min-w-0">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-surface/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Rss size={13} className="text-accent" />
            YouTube · Reddit · RSS
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl">
            AgentPress automates end-to-end AI content pipelines.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Connect your sources, set a schedule, and AgentPress handles the rest — pulling in new content hourly and running AI agents that write and publish finished posts automatically.
          </p>
          <ul className="mt-5 space-y-2">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check size={14} className="mt-0.5 shrink-0 text-green-600" />
              No code required — describe what you want each agent to write.
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check size={14} className="mt-0.5 shrink-0 text-green-600" />
              Runs on your schedule — hourly, daily, or manually on demand.
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check size={14} className="mt-0.5 shrink-0 text-green-600" />
              Publishes to WordPress directly, or saves a draft you can review first.
            </li>
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/community" className="inline-flex h-9 items-center gap-2 rounded bg-foreground px-4 text-sm font-medium text-background hover:opacity-90">
              Browse the community library <ArrowRight size={14} />
            </Link>
            <Link to="/pipelines" className="inline-flex h-9 items-center gap-2 rounded border border-input-border bg-surface px-3 text-sm font-medium hover:bg-muted">
              Go to your pipelines
            </Link>
          </div>
        </div>

        <HourlyFlow />
      </section>

      <section className="border-y bg-surface/75 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Community library</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start with a working pipeline.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Community pipelines are ready to run. Copy one to your workspace and customize every step — sources, agents, schedule, and output.</p>
            </div>
            <Link to="/community" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              Browse all community pipelines <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {starters.map((starter) => {
              const pipeline = pipelines.find((item) => item.slug === starter.slug)
              const isCopying = forkPipeline.isPending && forkPipeline.variables === pipeline?.id
              return (
                <StarterCard
                  key={starter.slug}
                  starter={starter}
                  disabled={!pipeline || forkPipeline.isPending}
                  loading={isCopying}
                  unavailable={!community.isLoading && !pipeline}
                  onClick={() => { void useStarter(starter.slug) }}
                />
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">How it works</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">From sources to published post — automatically.</h2>
        <div className="mt-5 grid gap-px overflow-hidden rounded border bg-border sm:grid-cols-4">
          <Process number="1" title="Connect sources">Add YouTube channels, subreddits, or RSS feeds. AgentPress checks them every hour for new content.</Process>
          <Process number="2" title="Store research">New items are saved as research your agents can read, summarize, and reference when building a post.</Process>
          <Process number="3" title="Run agents">Each agent handles one job — title, body, excerpt, or image — using the instructions you write.</Process>
          <Process number="4" title="Publish or review">Send the finished post straight to WordPress, or do a dry run first to check the output.</Process>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link to="/documentation" className="inline-flex h-9 items-center gap-2 rounded border border-input-border bg-surface px-3 text-sm font-medium hover:bg-muted">
            <BookOpen size={14} /> Read the documentation
          </Link>
          <Link to="/pipelines" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            Build your first pipeline <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  )
}

function HourlyFlow() {
  const sources = [
    { icon: Youtube, name: 'YouTube channels', detail: 'videos and transcripts' },
    { icon: Rss, name: 'Reddit communities', detail: 'new posts and discussions' },
    { icon: Rss, name: 'RSS feeds', detail: 'articles and updates' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-3 -z-10 rounded-2xl" />
      <div className="overflow-hidden rounded-xl border bg-surface shadow-2xl shadow-foreground/10">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2"><Clock3 size={14} className="text-accent" /><span className="text-xs font-semibold">Hourly research check</span></div>
          <span className="rounded bg-green-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600">Running</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="space-y-2">
            {sources.map(({ icon: Icon, name, detail }) => (
              <div key={name} className="flex items-center gap-3 rounded border bg-background px-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><Icon size={14} /></span>
                <div className="min-w-0 flex-1"><p className="text-xs font-medium">{name}</p><p className="text-[10px] text-muted-foreground">{detail}</p></div>
                <Check size={13} className="text-green-600" />
              </div>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><ArrowRight size={13} className="text-muted-foreground" /><div className="h-px flex-1 bg-border" /></div>
          <div className="rounded border border-accent/30 bg-accent/5 px-4 py-3">
            <p className="text-xs font-semibold">Agents create the post</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Each agent writes one part using your instructions and the stored research.</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[9px] font-medium text-muted-foreground">
              <span className="rounded border bg-surface px-1 py-1.5">Title</span>
              <span className="rounded border bg-surface px-1 py-1.5">Article</span>
              <span className="rounded border bg-surface px-1 py-1.5">Excerpt</span>
              <span className="rounded border bg-surface px-1 py-1.5">Image</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StarterCard({ starter, disabled, loading, unavailable, onClick }: {
  starter: typeof starters[number]
  disabled: boolean
  loading: boolean
  unavailable: boolean
  onClick: () => void
}) {
  const Icon = starter.icon
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex flex-col gap-3 rounded border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-surface text-muted-foreground"><Icon size={13} /></span>
          <h3 className="text-sm font-semibold">{starter.name}</h3>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
          <GitFork size={11} />{loading ? 'Copying…' : unavailable ? 'Unavailable' : 'Copy'}
        </span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{starter.description}</p>
    </button>
  )
}

function Process({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="bg-surface p-5"><span className="font-mono text-xs text-accent">0{number}</span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p></article>
}
