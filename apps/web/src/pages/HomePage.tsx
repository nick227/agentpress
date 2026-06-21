import { ArrowRight, Bot, Check, Clock3, Database, FileText, FlaskConical, GitFork, Rss, Youtube } from 'lucide-react'
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
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] dark:opacity-[0.06]"
      />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[380px] w-[700px] -translate-x-1/2" />

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16">
        <div className="min-w-0">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-surface/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Rss size={13} className="text-accent" />
            YouTube · Reddit · RSS
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl">
            AgentPress turns research feeds into scheduled content pipelines.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Every hour, AgentPress checks the YouTube channels, Reddit communities, and RSS feeds you follow. New items are stored as research your pipelines can summarize, combine, and publish on a schedule.
          </p>
          <div className="mt-5 flex max-w-xl gap-3 rounded border bg-surface/80 p-4 shadow-sm backdrop-blur">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-accent"><Bot size={16} /></span>
            <div>
              <p className="text-sm font-semibold">Different agents create different parts of the post.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">One agent writes the title, another writes the article, another creates the excerpt, and another can make the image. Together they produce one finished post.</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm">
            <Link to="/pipelines" className="inline-flex h-9 items-center gap-2 rounded border border-input-border bg-surface px-3 font-medium hover:bg-muted">View your pipelines <ArrowRight size={14} /></Link>
            <Link to="/documentation" className="font-medium text-muted-foreground hover:text-foreground">Read how it works</Link>
          </div>
        </div>

        <HourlyFlow />
      </section>

      <section className="border-y bg-surface/75 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Start with a working example</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Copy a community pipeline.</h2>
              <p className="mt-1 text-sm text-muted-foreground">The copy is private to your workspace. We open it immediately so you can inspect and change every step.</p>
            </div>
            <Link to="/community" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">Browse all community resources <ArrowRight size={14} /></Link>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">What the system does</p>
        <div className="mt-5 grid gap-px overflow-hidden rounded border bg-border sm:grid-cols-4">
          <Process number="1" title="Check sources">Pull new videos, posts, and feed entries every hour.</Process>
          <Process number="2" title="Store research">Keep source text, links, dates, and generated summaries.</Process>
          <Process number="3" title="Create each part">Different agents write the title, article, excerpt, and image.</Process>
          <Process number="4" title="Review or publish">Create a dry run or send the finished post to WordPress.</Process>
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
            <div className="flex items-center gap-2"><Bot size={13} className="text-accent" /><p className="text-xs font-semibold">Agents create the post</p></div>
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
      className="group flex min-h-44 flex-col rounded border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded border bg-surface text-muted-foreground"><Icon size={16} /></span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground"><GitFork size={12} />{loading ? 'Copying…' : unavailable ? 'Unavailable' : 'Use pipeline'}</span>
      </div>
      <h3 className="mt-5 text-sm font-semibold">{starter.name}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{starter.description}</p>
    </button>
  )
}

function Process({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="bg-surface p-5"><span className="font-mono text-xs text-accent">0{number}</span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p></article>
}
