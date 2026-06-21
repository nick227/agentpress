import { useState, type ReactNode } from 'react'
import { BookOpen, Check, FileText, Layers } from 'lucide-react'

type TabId = 'overview' | 'concepts' | 'data'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Start here' },
  { id: 'concepts', label: 'Core concepts' },
  { id: 'data', label: 'Data & publishing' },
]

export function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="page-shell page-shell--3xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground"><BookOpen size={16} /><span className="text-xs font-medium uppercase tracking-wide">Documentation</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">What is AgentPress?</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          AgentPress is a tool for creating repeatable AI content workflows. You provide information, a series of AI steps turns it into content, and AgentPress saves or publishes the result.
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
          Imagine you need 100 write movie reviews. You can plug-in a spreadsheet of movie titles and AgentPress will generate a review for each one.
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
          <ProcessLine number="1">Create a pipeline for the kind of content you want.</ProcessLine>
          <ProcessLine number="2">Add the information the pipeline needs.</ProcessLine>
          <ProcessLine number="3">Add and order the AI steps.</ProcessLine>
          <ProcessLine number="4">Run a preview and review the result.</ProcessLine>
          <ProcessLine number="5">Publish it, or adjust the pipeline and try again.</ProcessLine>
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
        Later agents can use earlier work. For example, a writer can use the researcher’s result with <Code>{'{agents.researcher}'}</Code>.
      </div>
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
