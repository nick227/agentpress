import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'

type BatchPreview = components['schemas']['BatchPreview']
type PipelineLoop = components['schemas']['PipelineLoop']

interface Props {
  preview: BatchPreview
  loop: PipelineLoop
  dryRun: boolean
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BatchPreviewModal({ preview, loop, dryRun, pending, onConfirm, onCancel }: Props) {
  const cursorLabel: Record<string, string> = {
    all_stored: 'All stored items',
    new_since_cursor: 'New items since last batch',
    date_range: 'Date range',
  }
  const selectionLabel = loop.loopType === 'dataset' ? 'Dataset rows' : (cursorLabel[loop.cursorMode] ?? loop.cursorMode)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-sm shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Start batch run</h3>
          <Button variant="ghost" size="icon-sm" onClick={onCancel}>×</Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-muted/30 rounded border px-4 py-3 space-y-2">
            <StatRow label="Runs to create" value={String(preview.itemCount)} />
            <StatRow label="Agents per run" value={String(preview.agentCount)} />
            <StatRow label="Estimated AI calls" value={String(preview.estimatedCalls)} />
            <StatRow label="Selection mode" value={selectionLabel} />
            <StatRow label="Mode" value={dryRun ? 'Dry run (preview only)' : 'Live (will publish)'} />
          </div>

          {preview.capped && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
              Capped at {preview.maxBatchSize} runs. Adjust the batch config to change this limit.
            </div>
          )}

          {(preview.items ?? []).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Items {(preview.items ?? []).length > 5 ? `(first 5 of ${(preview.items ?? []).length})` : ''}
              </p>
              <div className="space-y-0.5">
                {(preview.items ?? []).slice(0, 5).map((item) => (
                  <div key={item.itemId} className="text-xs text-muted-foreground truncate">
                    {item.publishedAt ? `${new Date(item.publishedAt).toLocaleDateString()} — ` : ''}{item.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" loading={pending} onClick={onConfirm}>
            {dryRun ? `Start ${preview.itemCount} dry runs` : `Start ${preview.itemCount} live runs`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}
