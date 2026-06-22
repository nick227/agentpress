import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, ExternalLink, Plus } from 'lucide-react'
import { useDeleteDestination, useDestinations } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowDeleteControls, useDeleteConfirm } from '@/components/ui/RowDeleteControls'
import { cn } from '@/lib/utils'
import { CommunityBrowser } from '@/features/content/CommunityBrowser'

type Destination = components['schemas']['Destination']

const AUTH_LABEL: Record<string, string> = {
  application_password: 'app password',
  token: 'token',
}

function stripScheme(url: string) {
  return url.replace(/^https?:\/\//, '')
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function DestinationsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useDestinations()
  const deleteDestination = useDeleteDestination()
  const { propsFor } = useDeleteConfirm(deleteDestination)
  const [search, setSearch] = useState('')
  const [showCommunity, setShowCommunity] = useState(false)

  const all = data?.data ?? []
  const destinations = search
    ? all.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          stripScheme(d.siteUrl).toLowerCase().includes(search.toLowerCase()) ||
          (d.username ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : all

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-px mt-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Destinations</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} publish target{all.length === 1 ? '' : 's'} configured
          </p>
        </div>
        <div className="page-header-actions">
          <Button size="sm" variant="outline" onClick={() => setShowCommunity(true)}>
            Browse Community
          </Button>
          <Button size="sm" onClick={() => navigate('/destinations/new')}>
            <Plus size={13} /> New Destination
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, URL, or username…"
          className="max-w-xs"
        />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No destinations"
          description="Connect a WordPress site to publish pipeline output directly."
          action={{ label: 'Add destination', onClick: () => navigate('/destinations/new') }}
        />
      ) : destinations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No destinations match your filter.</p>
      ) : (
        <div className="divide-y rounded border bg-surface">
          {destinations.map((dest) => (
            <DestinationRow
              key={dest.id}
              destination={dest}
              onClick={() => navigate(`/destinations/${dest.id}`)}
              {...propsFor(dest.id, dest.name)}
            />
          ))}
        </div>
      )}

      {showCommunity && <CommunityBrowser defaultTab="pipelines" onClose={() => setShowCommunity(false)} />}
    </div>
  )
}

function DestinationRow({
  destination,
  onClick,
  isConfirming,
  isDeleting,
  onConfirm,
  onCancel,
  onDelete,
}: {
  destination: Destination
  onClick: () => void
  isConfirming: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
  onDelete: () => Promise<void>
}) {
  const categoryCount = destination.defaultCategoryIds?.length ?? 0

  return (
    <div className="group flex items-center hover:bg-muted/30 transition-colors">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
      >
        <span className="mt-px h-2 w-2 shrink-0 rounded-full bg-green-500" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{destination.name}</p>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {destination.type}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <a
              href={destination.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline transition-colors"
            >
              {stripScheme(destination.siteUrl)}
              <ExternalLink size={9} className="ml-0.5 shrink-0" />
            </a>
            {destination.username && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{destination.username}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {destination.authType && (
            <span className="hidden sm:inline tabular-nums">
              {AUTH_LABEL[destination.authType] ?? destination.authType}
            </span>
          )}
          {categoryCount > 0 && (
            <span className="hidden sm:inline tabular-nums">
              {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
            </span>
          )}
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              destination.defaultStatus === 'publish'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {destination.defaultStatus === 'publish' ? 'Publish' : 'Draft'}
          </span>
          <span className="hidden md:inline text-muted-foreground/50 tabular-nums">
            updated {relativeDate(destination.updatedAt)}
          </span>
        </div>
      </button>

      <RowDeleteControls
        isConfirming={isConfirming}
        isDeleting={isDeleting}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  )
}
