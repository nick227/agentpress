import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  paused: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground line-through',
}

export function PipelineStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  )
}
