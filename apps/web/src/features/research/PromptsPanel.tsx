import { Link } from 'react-router-dom'
import { ExternalLink, Plus } from 'lucide-react'
import { usePrompts } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'

const PLACEHOLDER_HINT = 'Content prompts use {transcript} in the user prompt to inject collected item text.'

export function PromptsPanel() {
  const { data, isLoading } = usePrompts({ kind: 'CONTENT' })
  const prompts = data?.data ?? []
  const globalDefault = prompts.find((prompt) => prompt.isDefault) ?? prompts[0]

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold">Content prompts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shared catalog for research summaries. {PLACEHOLDER_HINT}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/prompts?kind=CONTENT" className="inline-flex h-7 items-center rounded border px-3 text-xs font-medium hover:bg-muted whitespace-nowrap">Browse all</Link>
          <Link to="/prompts/new?kind=CONTENT" className="inline-flex h-7 items-center gap-2 rounded bg-primary px-3 whitespace-nowrap text-xs font-medium text-primary-foreground hover:bg-primary/90"><Plus size={13} /> New prompt</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : prompts.length === 0 ? (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No content prompts yet.{' '}
          <Link to="/prompts/new?kind=CONTENT" className="text-accent hover:underline">Create one</Link>
          {' '}or run the seed to load community templates.
        </div>
      ) : (
        <div className="space-y-2">
          {globalDefault && (
            <p className="text-xs text-muted-foreground mb-3">
              Global default: <span className="font-medium text-foreground">{globalDefault.name}</span>
            </p>
          )}
          {prompts.map((prompt) => (
            <Link
              key={prompt.id}
              to={`/prompts/${prompt.slug}`}
              className="flex items-start justify-between gap-3 border rounded-lg p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{prompt.name}</p>
                  {prompt.isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">default</span>
                  )}
                  {prompt.visibility === 'PUBLIC' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">community</span>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{prompt.description}</p>
                )}
              </div>
              <ExternalLink size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
