import { ArrowRight, Braces, Check, CircleDot, Layers, Play, Send, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const capabilities = [
  { icon: Braces, label: 'Reusable inputs', detail: 'Variables and row data' },
  { icon: Layers, label: 'Ordered agents', detail: 'Research, write, edit' },
  { icon: Play, label: 'Safe previews', detail: 'Dry run before publish' },
  { icon: Send, label: 'Direct publishing', detail: 'Send finished work live' },
]

export function HomePage() {
  return (
    <div className="relative isolate min-h-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] dark:opacity-[0.06]"
        style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:py-24">
        <div className="min-w-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-surface/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles size={13} className="text-accent" />
            AI editorial workflows, built to repeat
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] text-foreground sm:text-6xl">
            Build once.<br />Publish with a <span className="text-accent">system.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            AgentPress turns your content process into a dependable pipeline. Define the inputs, arrange the AI steps, review the result, and send it live.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/pipelines/new" className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
              Build a pipeline <ArrowRight size={15} />
            </Link>
            <Link to="/pipelines" className="inline-flex h-10 items-center justify-center rounded border border-input-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              Open studio
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-600" /> Preview before publishing</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-600" /> Process CSV and Sheets rows</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-600" /> Keep every run traceable</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-600" /> Reuse community feeds and pipelines</span>
          </div>
        </div>

        <StudioPreview />
      </section>

      <section className="border-y bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl divide-y px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-3 px-1 py-5 sm:px-5 first:pl-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground"><Icon size={14} /></span>
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">The workflow</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From raw idea to finished post.</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">A visible process you can inspect, refine, and run again without rebuilding it from scratch.</p>
          <Link to="/documentation" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent">See how it works <ArrowRight size={14} /></Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded border bg-border sm:grid-cols-3">
          <WorkflowCard number="01" title="Give it context">Enter variables, connect research, or upload a dataset.</WorkflowCard>
          <WorkflowCard number="02" title="Run the system">Agents work in order and pass useful output forward.</WorkflowCard>
          <WorkflowCard number="03" title="Review or publish">Inspect a dry run, then publish when it is ready.</WorkflowCard>
        </div>
      </section>
    </div>
  )
}

function StudioPreview() {
  const steps = [
    { name: 'Research brief', meta: 'text · complete', active: false },
    { name: 'Draft article', meta: 'body · complete', active: false },
    { name: 'Editorial pass', meta: 'body · running', active: true },
    { name: 'Publish', meta: 'destination · queued', active: false },
  ]
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-3 -z-10 rounded-2xl bg-gradient-to-br from-accent/20 via-transparent to-foreground/5 blur-xl" />
      <div className="overflow-hidden rounded-xl border bg-surface shadow-2xl shadow-foreground/10">
        <div className="flex h-11 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2"><CircleDot size={13} className="text-accent" /><span className="text-xs font-semibold">Weekly editorial</span></div>
          <span className="rounded bg-green-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600">Active</span>
        </div>
        <div className="grid grid-cols-[84px_1fr] sm:grid-cols-[112px_1fr]">
          <div className="border-r bg-muted/20 p-3">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pipeline</p>
            {['Inputs', 'Agents', 'Output'].map((item, index) => <div key={item} className={`mb-1 rounded px-2 py-1.5 text-[10px] ${index === 1 ? 'bg-accent/10 font-medium text-accent' : 'text-muted-foreground'}`}>{item}</div>)}
          </div>
          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">Agents</p><p className="text-[10px] text-muted-foreground">Runs from top to bottom</p></div><span className="text-[10px] text-muted-foreground">3 of 4</span></div>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.name} className={`flex items-center gap-3 rounded border px-3 py-2.5 ${step.active ? 'border-accent/40 bg-accent/5' : 'bg-background'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold ${step.active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{step.name}</p><p className="truncate text-[9px] text-muted-foreground">{step.meta}</p></div>
                  {index < 2 && <Check size={12} className="text-green-600" />}
                  {step.active && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-accent" /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowCard({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="bg-surface p-5"><span className="font-mono text-xs text-accent">{number}</span><h3 className="mt-5 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p></article>
}
