import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, ChevronDown, ChevronUp, Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { useResearchItem, useResearchSummaries, useSummarizeResearchItem, useSummaryPrompts } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

type ResearchSummary = components['schemas']['ResearchSummary']
type SummaryPrompt = components['schemas']['SummaryPrompt']

interface Props {
  itemId: string
  sourceType?: string
  sourceSlug: string
}

export function ResearchItemPanel({ itemId, sourceSlug, sourceType = 'youtube' }: Props) {
  const { data: itemData, isLoading: itemLoading } = useResearchItem(itemId)
  const { data: summariesData } = useResearchSummaries(itemId)
  const { data: promptsData } = useSummaryPrompts()
  const [showTranscript, setShowTranscript] = useState(false)

  const item = itemData?.data
  const summaries = summariesData?.data ?? []
  const prompts = promptsData?.data ?? []

  const summaryByPromptId = Object.fromEntries(summaries.map((s) => [s.promptId, s]))

  if (itemLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!item) return <div className="p-6 text-sm text-muted-foreground">Item not found.</div>
  const itemDate = new Date(item.publishedAt).toISOString().slice(0, 10)
  const exactSummaryRef = `{${sourceSlug}.${itemDate}.summary}`

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-base font-semibold leading-snug mb-1">{item.title}</h1>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span>{new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <a href={item.itemUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
            {sourceType === 'youtube' ? 'Watch on YouTube' : sourceType === 'reddit' ? 'View on Reddit' : 'Read article'} <ExternalLink size={10} />
          </a>
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{exactSummaryRef}</span>
        </div>
      </div>

      {/* Summaries */}
      {prompts.length === 0 ? (
        <div className="border rounded-lg p-4 bg-muted/20 text-sm text-muted-foreground mb-5">
          No summary prompts configured — go to "Summary Prompts" to add some.
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summaries</h2>
          {prompts.map((prompt) => (
            <SummaryCard
              key={prompt.id}
              prompt={prompt}
              summary={summaryByPromptId[prompt.id]}
              itemId={itemId}
              hasTranscript={Boolean(item.content)}
            />
          ))}
        </div>
      )}

      {/* Transcript */}
      <div>
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-2"
        >
          {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {sourceType === 'youtube' ? 'Transcript' : 'Content'}
          {item.content ? ` · ~${Math.round(item.content.length / 5).toLocaleString()} words` : ' — not available'}
        </button>
        {showTranscript && (
          <div className="border rounded-lg p-4 bg-muted/20 max-h-80 overflow-y-auto">
            {item.content ? (
              <pre className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap font-mono">{item.content}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">Content not available for this item.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  prompt,
  summary,
  itemId,
  hasTranscript,
}: {
  prompt: SummaryPrompt
  summary: ResearchSummary | undefined
  itemId: string
  hasTranscript: boolean
}) {
  const summarize = useSummarizeResearchItem()
  const isGenerating = summarize.isPending && (summarize.variables as any)?.promptId === prompt.id

  async function handleGenerate() {
    try {
      await summarize.mutateAsync({ itemId, promptId: prompt.id })
      toast.success(`"${prompt.name}" summary generated`)
    } catch (err: any) {
      toast.error(err.message ?? 'Generation failed')
    }
  }

  const status = summary?.status ?? 'none'

  return (
    <div className="border rounded-lg p-3.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold">{prompt.name}</p>
          {prompt.description && <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>}
        </div>
        <div className="shrink-0">
          {status === 'processing' || isGenerating ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Generating…
            </span>
          ) : status === 'done' ? (
            <Button variant="ghost" size="sm" loading={isGenerating} onClick={handleGenerate} title="Regenerate">
              <RefreshCw size={12} />
            </Button>
          ) : (
            <Button size="sm" disabled={!hasTranscript} loading={isGenerating} onClick={handleGenerate}>
              <Sparkles size={12} />
              {status === 'failed' ? 'Retry' : 'Generate'}
            </Button>
          )}
        </div>
      </div>

      {status === 'done' && summary?.text && (
        <div className="bg-muted/30 rounded p-3 mt-1">
          <p className="text-sm leading-relaxed">{summary.text}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {summary.text.length} chars · {new Date(summary.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {status === 'failed' && (
        <p className="text-xs text-destructive mt-1">
          {hasTranscript ? 'Generation failed — click Retry.' : 'No content available for this item.'}
        </p>
      )}

      {status === 'none' && !hasTranscript && (
        <p className="text-xs text-muted-foreground mt-1">No content available.</p>
      )}
    </div>
  )
}
