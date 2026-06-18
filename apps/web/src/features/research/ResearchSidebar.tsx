import { Info, SlidersHorizontal, Video, ChevronLeft, ChevronRight } from 'lucide-react'
import type { components } from '@project/sdk'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ResearchSelection } from '@/pages/ResearchSourcePage'

type ResearchSource = components['schemas']['ResearchSource']
type ResearchItem = components['schemas']['ResearchItem']

interface ItemsPage {
  data: ResearchItem[]
  total: number
  page: number
  pages: number
}

interface Props {
  source: ResearchSource
  itemsPage: ItemsPage | undefined
  itemsLoading: boolean
  page: number
  onPageChange: (p: number) => void
  selection: ResearchSelection
  onSelect: (s: ResearchSelection) => void
}

export function ResearchSidebar({ source, itemsPage, itemsLoading, page, onPageChange, selection, onSelect }: Props) {
  const items = itemsPage?.data ?? []
  const pages = itemsPage?.pages ?? 1
  const total = itemsPage?.total ?? (source.itemCount ?? 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarItem
          label="Source Info"
          icon={<Info size={13} />}
          active={selection.type === 'info'}
          onClick={() => onSelect({ type: 'info' })}
        />
        <SidebarItem
          label="Summary Prompts"
          icon={<SlidersHorizontal size={13} />}
          active={selection.type === 'prompts'}
          onClick={() => onSelect({ type: 'prompts' })}
        />

        <div className="px-3 pt-4 pb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Videos · {total}
          </span>
        </div>

        {itemsLoading ? (
          <div className="px-4 space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-1.5 text-xs text-muted-foreground">No videos yet — click "Check for new video"</p>
        ) : (
          items.map((item) => (
            <SidebarItem
              key={item.id}
              label={item.videoTitle}
              sublabel={
                new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
                (item.summaryCount ? ` · ${item.summaryCount} summary` : '')
              }
              icon={<Video size={12} className="text-muted-foreground shrink-0" />}
              active={selection.type === 'item' && selection.id === item.id}
              onClick={() => onSelect({ type: 'item', id: item.id })}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="shrink-0 border-t px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarItem({
  label,
  sublabel,
  icon,
  active,
  onClick,
}: {
  label: string
  sublabel?: string
  icon?: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors',
        active ? 'bg-accent/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium truncate">{label}</span>
        {sublabel && <span className="block text-xs text-muted-foreground truncate">{sublabel}</span>}
      </span>
    </button>
  )
}
