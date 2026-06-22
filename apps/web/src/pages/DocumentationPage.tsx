import { useState, type ReactNode } from 'react'
import { ArrowRight, BookOpen, Check, Clock3, Database, FileText, FlaskConical, GitFork, Layers, Rss, Youtube } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCommunityPipelines, useForkCommunityPipeline } from '@project/sdk'

type TabId = 'quickstart' | 'overview' | 'concepts' | 'references' | 'data'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'quickstart', label: 'Quick start' },
  { id: 'overview', label: 'Overview' },
  { id: 'concepts', label: 'Core concepts' },
  { id: 'references', label: 'References' },
  { id: 'data', label: 'Data & publishing' },
]

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

export function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('quickstart')

  return (
    <div className="page-shell page-shell--5xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground"><BookOpen size={16} /><span className="text-xs font-medium uppercase tracking-wide">Documentation</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">What is AgentPress</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          AgentPress is a tool for automating AI workflows. You provide information, AI turns it into new content, and AgentPress saves and publishes the result.
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded border bg-muted/30 p-1" role="tablist" aria-label="Documentation sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'quickstart' && <QuickStartTab />}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'concepts' && <ConceptsTab />}
      {activeTab === 'references' && <ReferencesTab />}
      {activeTab === 'data' && <DataTab />}
    </div>
  )
}

// ─── Quick Start Tab ──────────────────────────────────────────────────────────

function QuickStartTab() {
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
    <div role="tabpanel" className="space-y-10">
      {/* Hero intro */}
      <section className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-start lg:gap-16">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
            Automates AI agents
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Connect your sources, set a schedule, and AgentPress handles the rest — pulling in new content hourly and running AI agents that write and publish finished posts automatically.
          </p>
          <ul className="mt-4 space-y-2">
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
              Publishes to remote server and saves a reusable draft.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
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

      {/* How it works */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">How it works</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">From sources to published post — automatically.</h2>
        <div className="mt-4 grid gap-px overflow-hidden rounded border bg-border sm:grid-cols-4">
          <Process number="1" title="Connect sources">Add YouTube channels, subreddits, or RSS feeds. AgentPress checks them every hour for new content.</Process>
          <Process number="2" title="Store research">New items are saved as research your agents can read, summarize, and reference when building a post.</Process>
          <Process number="3" title="Run agents">Each agent handles one job — title, body, excerpt, or image — using the instructions you write.</Process>
          <Process number="4" title="Publish or review">Send the finished post straight to WordPress, or do a dry run first to check the output.</Process>
        </div>
      </section>

      {/* Community starters */}
      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Community library</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Start with a working pipeline.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Community pipelines are ready to run. Copy one to your workspace and customize every step — sources, agents, schedule, and output.</p>
          </div>
          <Link to="/community" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            Browse all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
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

function Process({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <article className="bg-surface p-5"><span className="font-mono text-xs text-accent">0{number}</span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p></article>
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div role="tabpanel" className="space-y-8">
      <section className="rounded border bg-surface p-5">
        <h2 className="text-base font-semibold">A simple example</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Imagine you need a one hundred movie reviews. You can plug-in a spreadsheet of titles and AgentPress will systematically generate a custom review for each one.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">What can you make?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Example title="Social media">Condense large amounts of content into short blurbs.</Example>
          <Example title="Team updates">Condense team communications into automated updates.</Example>
          <Example title="YouTube Analysis">Pulling YouTube transcripts is easy with AgentPress.</Example>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">The whole process</h2>
        <ol className="divide-y rounded border bg-surface">
          <ProcessLine number="1">Setup web sources to pull feeds from.</ProcessLine>
          <ProcessLine number="2">Add agents to create your new content.</ProcessLine>
          <ProcessLine number="3">Arrange and sort your content.</ProcessLine>
          <ProcessLine number="4">Run a preview and review the result.</ProcessLine>
          <ProcessLine number="5">Publish or adjust the pipeline and try again.</ProcessLine>
        </ol>
      </section>
    </div>
  )
}

// ─── Concepts Tab ─────────────────────────────────────────────────────────────

function ConceptsTab() {
  return (
    <div role="tabpanel" className="space-y-5">
      <Intro title="The four things to know">These are the basic pieces you use to build a workflow.</Intro>
      <div className="divide-y rounded border bg-surface">
        <Concept title="Pipeline">The complete workflow. It holds your inputs, AI steps, and publishing settings.</Concept>
        <Concept title="Variables">Information that changes between runs, such as a topic, tone, or length. Use one in a prompt as <Code>{'{topic}'}</Code>.</Concept>
        <Concept title="Agents">The ordered AI steps. An agent might research, write, edit, create an image, or format the final post.</Concept>
        <Concept title="Run">One use of a pipeline. Every run keeps its inputs, generated content, status, and errors.</Concept>
      </div>
      <div className="rounded border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        Later agents can use earlier work. For example, a writer can use the researcher's output with <Code>{'{researcher.output}'}</Code>. See the <strong className="text-foreground">References</strong> tab for the full syntax.
      </div>
    </div>
  )
}

// ─── References Tab ───────────────────────────────────────────────────────────

function ReferencesTab() {
  return (
    <div role="tabpanel" className="space-y-6">
      <Intro title="Pulling data into prompts">
        In any agent prompt, wrap a name in curly braces to insert a value at run time. AgentPress fills these in before the AI runs.
      </Intro>

      <section className="divide-y rounded border bg-surface">
        <RefRow syntax="{topic}" meaning="A pipeline variable you define (topic, tone, audience, etc.)" />
        <RefRow syntax="{outline.output}" meaning="The full output from a previous agent — use that agent's UID" />
        <RefRow syntax="{writer.body}" meaning="Same output, keyed by the agent's Output Use (body, title, excerpt, …)" />
        <RefRow syntax="{ziptrader.summary}" meaning="Latest summary from a research feed — use the feed slug as the root" />
        <RefRow syntax="{row.title}" meaning="A column from the current spreadsheet or CSV row" />
        <RefRow syntax="{context}" meaning="A value injected when running over a list or loop" />
      </section>

      <section className="rounded border bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold">How to think about it</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          The word before the dot is the <strong className="text-foreground">name of the thing</strong>. The word after the dot is the <strong className="text-foreground">field</strong> you want from it.
        </p>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li><Code>{'{outline.output}'}</Code> — "give me the output from the agent named <em>outline</em>"</li>
          <li><Code>{'{ziptrader.summary}'}</Code> — "give me the summary from the feed named <em>ziptrader</em>"</li>
          <li><Code>{'{topic}'}</Code> — "give me the pipeline variable named <em>topic</em>"</li>
        </ul>
      </section>

      <section className="rounded border bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold">Chaining agents</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Agents run top to bottom. Each one can read what came before it by UID:
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-4 text-xs leading-6 text-foreground">
{`Agent "outline"  →  writes a plan
Agent "writer"   →  prompt includes:

  Turn this outline into a full post:
  {outline.output}`}
        </pre>
        <p className="text-sm leading-6 text-muted-foreground">
          Use <Code>{'{uid.output}'}</Code> for the raw text. If the prior agent's Output Use is set to Body or Title, you can also write <Code>{'{uid.body}'}</Code> or <Code>{'{uid.title}'}</Code>.
        </p>
      </section>

      <section className="rounded border bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold">Research feeds</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Every research source has a slug (from its name). Common fields:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <FeedField field="summary" desc="AI summary of the latest item" />
          <FeedField field="content" desc="Full transcript or article text" />
          <FeedField field="title" desc="Title of the source item" />
          <FeedField field="date" desc="Publish date (YYYY-MM-DD)" />
          <FeedField field="url" desc="Link to the source item" />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Pin a specific day: <Code>{'{wallstreetbets.2026-06-18.summary}'}</Code>
        </p>
      </section>

      <div className="rounded border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        <strong className="text-foreground">Tip:</strong> name each agent with a short, unique UID (like <Code>outline</Code> or <Code>writer</Code>). That UID is what you type in prompts — no <Code>agents.</Code> prefix needed.
      </div>
    </div>
  )
}

function RefRow({ syntax, meaning }: { syntax: string; meaning: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <Code>{syntax}</Code>
      <p className="text-sm leading-6 text-muted-foreground">{meaning}</p>
    </div>
  )
}

function FeedField({ field, desc }: { field: string; desc: string }) {
  return (
    <div className="rounded bg-muted/40 px-3 py-2">
      <Code>{'{slug.' + field + '}'}</Code>
      <p className="mt-1 text-muted-foreground">{desc}</p>
    </div>
  )
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab() {
  return (
    <div role="tabpanel" className="space-y-6">
      <Intro title="Run once or run a list">Enter values for one article, or provide many rows and create one run for each row.</Intro>

      <section className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon={<Layers size={16} />} title="CSV and Google Sheets">
          Add a file or shareable sheet in Variables. Each row runs separately and can use values such as <Code>{'{row.name}'}</Code> or <Code>{'{row.tone}'}</Code>.
        </InfoCard>
        <InfoCard icon={<FileText size={16} />} title="Research feeds">
          Store source material and run a pipeline for all items, only new items, or items in a date range.
        </InfoCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Preview before publishing</h2>
        <div className="divide-y rounded border bg-surface">
          <Concept title="Dry run">Creates the content for you to inspect. Nothing is published.</Concept>
          <Concept title="Live run">Creates the content and sends it to the connected destination.</Concept>
        </div>
      </section>

      <div className="flex gap-3 rounded border border-green-600/20 bg-green-600/5 p-4">
        <Check size={16} className="mt-0.5 shrink-0 text-green-600" />
        <p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Good habit:</strong> begin with a dry run, check the content, and use a live run only when the pipeline behaves the way you expect.</p>
      </div>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Example({ title, children }: { title: string; children: ReactNode }) {
  return <article className="rounded border bg-surface p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p></article>
}

function ProcessLine({ number, children }: { number: string; children: ReactNode }) {
  return <li className="flex items-center gap-3 px-4 py-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{number}</span><span className="text-sm">{children}</span></li>
}

function Intro({ title, children }: { title: string; children: ReactNode }) {
  return <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p></div>
}

function Concept({ title, children }: { title: string; children: ReactNode }) {
  return <div className="px-4 py-3"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p></div>
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="rounded border bg-surface p-4"><div className="mb-2 flex items-center gap-2 text-muted-foreground">{icon}<h3 className="text-sm font-semibold text-foreground">{title}</h3></div><p className="text-sm leading-6 text-muted-foreground">{children}</p></article>
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
}
