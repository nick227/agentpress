import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { activityTooltip, compactRelativeTime } from './explorerTime'
import { Children } from 'react'

type ResourceGroupProps = {
  label: string
  icon: LucideIcon
  indexHref?: string
  addHref?: string
  onRefetch?: () => void
  isRefetching?: boolean
  isRefreshDisabled?: boolean
  refreshTitle?: string
  children: React.ReactNode
}

// Top-level resource headings shared by pipelines, schedules, research, destinations, and runs.
export function ResourceGroup({
  label,
  icon: Icon,
  indexHref,
  addHref,
  onRefetch,
  isRefetching,
  isRefreshDisabled,
  refreshTitle,
  children,
}: ResourceGroupProps) {
  return (
    <div>
      <div className="group flex items-center gap-1 p-2 font-semibold uppercase tracking-wide text-muted-foreground bg-gray-100">
        <Icon size={11} />
        {indexHref ? (
          <Link
            to={indexHref}
            className="ml-0.5 flex-1 hover:text-foreground transition-colors flex items-center"
            title={`View all ${label.toLowerCase()}`}
          >
            {label}
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({Children.count(children)})
            </span>
          </Link>
        ) : (
          <span className="ml-0.5 flex-1">{label}</span>
        )}
        {onRefetch && (
          <button
            type="button"
            onClick={onRefetch}
            disabled={isRefetching || isRefreshDisabled}
            title={refreshTitle ?? `Reload ${label.toLowerCase()}`}
            className="rounded flex items-center p-1 py-0.5 leading-none opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
          >
            <RefreshCw size={10} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        )}
        {addHref && (
          <Link
            to={addHref}
            className="rounded flex items-center px-1 text-sm leading-none opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
            title={`Add ${label.toLowerCase()}`}
          >
            +
          </Link>
        )}
      </div>
      <div className="max-h-[30vh] overflow-auto">{children}</div>
    </div>
  )
}

type ResearchCategoryGroupProps = {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
  onRefetch: () => void
  isRefetching: boolean
  disabled: boolean
  children: React.ReactNode
}

// Research-only subheading with collapse and category-scoped refresh behavior.
export function ResearchCategoryGroup({
  label,
  count,
  collapsed,
  onToggle,
  onRefetch,
  isRefetching,
  disabled,
  children,
}: ResearchCategoryGroupProps) {
  return (
    <div>
      <div className="group/category flex items-center gap-1 py-1 pl-4 pr-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-foreground"
          title={`${collapsed ? 'Expand' : 'Collapse'} ${label}`}
        >
          {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
          <span className="truncate">{label}</span>
          <span className="font-normal tabular-nums">{count}</span>
        </button>
        <button
          type="button"
          onClick={onRefetch}
          disabled={disabled}
          title={`Check active ${label} feeds`}
          className="rounded p-0.5 opacity-0 hover:bg-muted hover:text-foreground group-hover/category:opacity-100 disabled:opacity-30"
        >
          <RefreshCw size={9} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>
      {!collapsed && children}
    </div>
  )
}

type ResourceLinkProps = {
  href: string
  label: string
  active: boolean
  status: string
  activityAt?: string | null
  activityLabel?: string
  activityState?: string
  onRefetch?: () => void
  isRefetching?: boolean
  refreshDisabled?: boolean
  refreshTitle?: string
}

// A single navigable row. Optional refresh behavior is used by research feeds.
export function ResourceLink({
  href,
  label,
  active,
  status,
  activityAt,
  activityLabel,
  activityState,
  onRefetch,
  isRefetching,
  refreshDisabled,
  refreshTitle,
}: ResourceLinkProps) {
  const statusClass = status === 'active' || status === 'configured'
    ? 'bg-green-500'
    : status === 'failed'
      ? 'bg-red-500'
      : status === 'paused' || status === 'warning'
        ? 'bg-amber-400'
        : 'bg-muted-foreground/40'

  return (
    <div className={cn('group/resource flex items-center rounded-l text-muted-foreground hover:bg-muted/60 hover:text-foreground', active && 'bg-accent/10 text-foreground')}>
      <Link to={href} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-xs" title={label}>
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusClass)} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {activityLabel && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70" title={activityTooltip(activityLabel, activityAt)}>
            {activityState ?? compactRelativeTime(activityAt)}
          </span>
        )}
      </Link>
      {onRefetch && (
        <button
          type="button"
          onClick={onRefetch}
          disabled={isRefetching || refreshDisabled}
          title={refreshTitle ?? `Reload ${label}`}
          className="mr-2 rounded p-0.5 opacity-0 hover:bg-muted hover:text-foreground group-hover/resource:opacity-100 disabled:opacity-50"
        >
          <RefreshCw size={9} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  )
}
