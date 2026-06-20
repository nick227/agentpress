import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, ChevronRight, Database, FlaskConical, Search, Workflow } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAccountNavigation } from '@project/sdk'
import type { components } from '@project/sdk'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type NavigationAccount = components['schemas']['NavigationAccount']
const STORAGE_KEY = 'agentpress.explorer.expanded-accounts'

function loadExpanded() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}

export function GlobalExplorerSidebar() {
  const { data, isLoading } = useAccountNavigation()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded)
  const accounts = data?.data ?? []
  const activeAccountSlug = /^\/accounts\/([^/]+)/.exec(location.pathname)?.[1]

  useEffect(() => {
    if (!activeAccountSlug) return
    setExpanded((current) => {
      if (current.has(activeAccountSlug)) return current
      const next = new Set(current).add(activeAccountSlug)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [activeAccountSlug])

  const visibleAccounts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.flatMap((account) => {
      const pipelines = account.pipelines.filter((item) => item.name.toLowerCase().includes(needle))
      const schedules = account.schedules.filter((item) => item.name.toLowerCase().includes(needle))
      const researchSources = account.researchSources.filter((item) => item.name.toLowerCase().includes(needle))
      const destinations = account.destinations.filter((item) => item.name.toLowerCase().includes(needle))
      if (account.name.toLowerCase().includes(needle)) return [account]
      return pipelines.length || schedules.length || researchSources.length || destinations.length
        ? [{ ...account, pipelines, schedules, researchSources, destinations }]
        : []
    })
  }, [accounts, query])

  function toggleAccount(slug: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b p-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter navigation" className="h-8 pl-8 text-xs" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 pb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accounts</span>
          <Link to="/" className="text-[11px] text-muted-foreground hover:text-foreground">View all</Link>
        </div>
        {isLoading ? <ExplorerSkeleton /> : visibleAccounts.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">{query ? 'No matching resources.' : 'No accounts yet.'}</p>
        ) : visibleAccounts.map((account) => {
          const isExpanded = Boolean(query.trim()) || expanded.has(account.slug)
          const isActive = activeAccountSlug === account.slug
          return (
            <div key={account.id} className="mb-1">
              <div className={cn('group flex items-center pr-2', isActive && 'bg-muted/50')}>
                <button type="button" onClick={() => toggleAccount(account.slug)} className="p-2 pl-3 text-muted-foreground hover:text-foreground" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${account.name}`}>
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <Link to={`/accounts/${account.slug}`} className="min-w-0 flex-1 py-2 text-xs font-semibold truncate" title={account.name}>{account.name}</Link>
              </div>
              {isExpanded && <AccountResources account={account} pathname={location.pathname} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AccountResources({ account, pathname }: { account: NavigationAccount; pathname: string }) {
  return (
    <div className="pb-2 pl-5">
      <ResourceGroup label="Pipelines" icon={Workflow} addHref={`/accounts/${account.slug}?create=pipeline#pipelines`}>
        {account.pipelines.map((pipeline) => (
          <ResourceLink key={pipeline.id} href={`/accounts/${account.slug}/pipelines/${pipeline.slug}`} label={pipeline.name} active={pathname.includes(`/pipelines/${pipeline.slug}`)} status={pipeline.status} />
        ))}
      </ResourceGroup>
      <ResourceGroup label="Schedules" icon={CalendarClock} addHref={`/accounts/${account.slug}/schedules/new`}>
        {account.schedules.map((schedule) => (
          <ResourceLink key={schedule.id} href={`/accounts/${account.slug}/schedules/${schedule.id}`} label={schedule.name} active={pathname.includes(`/schedules/${schedule.id}`)} status={schedule.lastExecutionStatus === 'failed' ? 'failed' : schedule.lastExecutionStatus === 'partial' ? 'warning' : schedule.enabled ? 'active' : 'paused'} />
        ))}
      </ResourceGroup>
      <ResourceGroup label="Research" icon={FlaskConical} addHref={`/accounts/${account.slug}?create=research#research`}>
        {account.researchSources.map((source) => (
          <ResourceLink key={source.id} href={`/accounts/${account.slug}/research/${source.slug}`} label={source.name} active={pathname.includes(`/research/${source.slug}`)} status={source.status} />
        ))}
      </ResourceGroup>
      {account.destinations.length > 0 && <ResourceGroup label="Destinations" icon={Database} addHref={`/accounts/${account.slug}`}>
        {account.destinations.map((destination) => (
          <ResourceLink key={destination.id} href={`/accounts/${account.slug}`} label={destination.name} active={false} status="configured" />
        ))}
      </ResourceGroup>}
    </div>
  )
}

function ResourceGroup({ label, icon: Icon, addHref, children }: { label: string; icon: typeof Workflow; addHref: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="group flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground">
        <Icon size={11} />
        <span className="flex-1 text-xl"> {label}</span>
        <Link to={addHref} className="rounded px-1 text-sm leading-none opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100" title={`Add ${label.toLowerCase()}`}>+</Link>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ResourceLink({ href, label, active, status }: { href: string; label: string; active: boolean; status: string }) {
  const statusClass = status === 'active' || status === 'configured'
    ? 'bg-green-500'
    : status === 'failed'
      ? 'bg-red-500'
      : status === 'paused' || status === 'warning'
        ? 'bg-amber-400'
        : 'bg-muted-foreground/40'
  return (
    <Link to={href} className={cn('flex items-center gap-2 rounded-l px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground', active && 'bg-accent/10 text-foreground')} title={label}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusClass)} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function ExplorerSkeleton() {
  return <div className="px-3 py-2 space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-5 w-full" />)}</div>
}
