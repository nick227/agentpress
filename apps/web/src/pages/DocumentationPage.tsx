import { useState, type ReactNode } from 'react'
import { BookOpen, Check, FileText, Layers } from 'lucide-react'

type TabId = 'overview' | 'concepts' | 'references' | 'data'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Start here' },
  { id: 'concepts', label: 'Core concepts' },
  { id: 'references', label: 'References' },
  { id: 'data', label: 'Data & publishing' },
]

export function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="page-shell page-shell--3xl space-y-6">
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

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'concepts' && <ConceptsTab />}
      {activeTab === 'references' && <ReferencesTab />}
      {activeTab === 'data' && <DataTab />}
    </div>
  )
}

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
          <ProcessLine number="5">Publish or   adjust the pipeline and try again.</ProcessLine>
        </ol>
      </section>
    </div>
  )
}

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
        Later agents can use earlier work. For example, a writer can use the researcher’s output with <Code>{'{researcher.output}'}</Code>. See the <strong className="text-foreground">References</strong> tab for the full syntax.
      </div>
    </div>
  )
}

function ReferencesTab() {
  return (
    <div role="tabpanel" className="space-y-6">
      <Intro title="Pulling data into prompts">
        In any agent prompt, wrap a name in curly braces to insert a value at run time. AgentPress fills these in before the AI runs.
      </Intro>

      <section className="divide-y rounded border bg-surface">
        <RefRow
          syntax="{topic}"
          meaning="A pipeline variable you define (topic, tone, audience, etc.)"
        />
        <RefRow
          syntax="{outline.output}"
          meaning="The full output from a previous agent — use that agent’s UID"
        />
        <RefRow
          syntax="{writer.body}"
          meaning="Same output, keyed by the agent’s Output Use (body, title, excerpt, …)"
        />
        <RefRow
          syntax="{ziptrader.summary}"
          meaning="Latest summary from a research feed — use the feed slug as the root"
        />
        <RefRow
          syntax="{row.title}"
          meaning="A column from the current spreadsheet or CSV row"
        />
        <RefRow
          syntax="{context}"
          meaning="A value injected when running over a list or loop"
        />
      </section>

      <section className="rounded border bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold">How to think about it</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          The word before the dot is the <strong className="text-foreground">name of the thing</strong>. The word after the dot is the <strong className="text-foreground">field</strong> you want from it.
        </p>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li><Code>{'{outline.output}'}</Code> — “give me the output from the agent named <em>outline</em>”</li>
          <li><Code>{'{ziptrader.summary}'}</Code> — “give me the summary from the feed named <em>ziptrader</em>”</li>
          <li><Code>{'{topic}'}</Code> — “give me the pipeline variable named <em>topic</em>”</li>
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
          Use <Code>{'{uid.output}'}</Code> for the raw text. If the prior agent’s Output Use is set to Body or Title, you can also write <Code>{'{uid.body}'}</Code> or <Code>{'{uid.title}'}</Code>.
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
