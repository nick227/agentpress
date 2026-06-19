import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Plus, Pencil, Trash2, Zap, LayoutTemplate, FlaskConical, Video, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useAccount, usePipelines, useDeleteAccount, useDeletePipeline, useResearchSources, useSyncAccount, useCheckResearchSource } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountFormDialog } from '@/features/accounts/AccountFormDialog'
import { CreatePipelineDialog } from '@/features/pipelines/CreatePipelineDialog'
import { PipelineStatusBadge } from '@/features/pipelines/PipelineStatusBadge'
import { TemplateBrowser } from '@/features/content/TemplateBrowser'
import { CreateResearchSourceDialog } from '@/features/research/CreateResearchSourceDialog'
import { researchCheckFeedback } from '@/features/research/researchCheckFeedback'
import { cn } from '@/lib/utils'

type SyncResult = components['schemas']['SyncResult']
type ResearchSyncProgress = {
  currentSourceId?: string
  currentSourceName?: string
  completed: number
  total: number
}

export function AccountDetailPage() {
  const { accountSlug } = useParams<{ accountSlug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: accountData, isLoading: accountLoading } = useAccount(accountSlug!)
  const account = accountData?.data
  const { data: pipelinesData, isLoading: pipelinesLoading } = usePipelines(account?.id ?? '')
  const { data: researchData, isLoading: researchLoading } = useResearchSources(account?.id ?? '')
  const deleteAccount = useDeleteAccount()
  const deletePipeline = useDeletePipeline()
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false)
  const [showCreateResearch, setShowCreateResearch] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pipelinePendingDelete, setPipelinePendingDelete] = useState<string | null>(null)

  const sync = useSyncAccount()
  const checkResearchSource = useCheckResearchSource()
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncResultResearchOnly, setSyncResultResearchOnly] = useState(false)
  const [researchSyncing, setResearchSyncing] = useState(false)
  const [researchSyncProgress, setResearchSyncProgress] = useState<ResearchSyncProgress | null>(null)
  const [newResearchSourceIds, setNewResearchSourceIds] = useState<Set<string>>(new Set())

  const pipelines = pipelinesData?.data ?? []
  const researchSources = researchData?.data ?? []
  const activeResearchSources = researchSources.filter((source) => source.status === 'active')

  async function handleSync() {
    if (!account) return
    try {
      const result = await sync.mutateAsync(account.id)
      setSyncResultResearchOnly(false)
      setSyncResult(result.data)
    } catch (err: any) {
      toast.error(err.message ?? 'Sync failed')
    }
  }

  async function handleSyncResearch() {
    if (!account || activeResearchSources.length === 0) return

    const results: SyncResult['research']['results'] = []
    setResearchSyncing(true)
    setNewResearchSourceIds(new Set())
    setResearchSyncProgress({ completed: 0, total: activeResearchSources.length })

    try {
      for (const [index, source] of activeResearchSources.entries()) {
        setResearchSyncProgress({
          currentSourceId: source.id,
          currentSourceName: source.name,
          completed: index,
          total: activeResearchSources.length,
        })

        try {
          const result = await checkResearchSource.mutateAsync(source.id)
          const r = result.data
          const feedback = researchCheckFeedback(source.sourceType, r)
          const transcriptFailed = source.sourceType === 'youtube' && r.latest && !r.latest.hasTranscript
          results.push({
            sourceName: source.name,
            sourceId: source.id,
            newItem: r.newItem,
            updatedCount: r.updatedCount,
            itemTitle: r.latest?.title ?? (r.newItem && r.item ? r.item.title : undefined),
            statusMessage: feedback.message,
            error: !r.checked ? feedback.message : transcriptFailed ? feedback.message : undefined,
          })
        } catch (err: any) {
          results.push({
            sourceName: source.name,
            sourceId: source.id,
            newItem: false,
            error: err.message ?? 'Unknown error',
          })
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['research-sources', account.id] })

      setNewResearchSourceIds(new Set(results.filter((result) => result.newItem).map((result) => result.sourceId)))

      setSyncResultResearchOnly(true)
      setSyncResult({
        research: {
          checked: results.length,
          newItems: results.filter((result) => result.newItem).length,
          results,
        },
        pipelines: {
          started: 0,
          skipped: 0,
          results: [],
        },
      })
    } finally {
      setResearchSyncing(false)
      setResearchSyncProgress(null)
    }
  }

  async function handleDeleteAccount() {
    if (!account) return
    await deleteAccount.mutateAsync(account.id)
    toast.success('Account deleted')
    navigate('/', { replace: true })
  }

  async function handleDeletePipeline(pipelineId: string) {
    if (!account) return
    try {
      await deletePipeline.mutateAsync({ pipelineId, accountId: account.id })
      setPipelinePendingDelete(null)
      toast.success('Pipeline deleted')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete pipeline')
    }
  }

  if (accountLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-muted-foreground">Account not found.</p>
        <Button variant="link" onClick={() => navigate('/')}>← Back to accounts</Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ChevronLeft size={14} />
        Accounts
      </button>

      {/* Account header */}
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-lg font-semibold">{account.name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={sync.isPending}
            disabled={researchSyncing}
            onClick={handleSync}
            title="Check all active research feeds and run all ready pipelines"
          >
            <RefreshCw size={13} />
            Sync All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditAccount(true)}>
            <Pencil size={13} />
            Edit
          </Button>
          {!confirmDelete ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="destructive"
                size="sm"
                loading={deleteAccount.isPending}
                onClick={handleDeleteAccount}
              >
                Delete account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Account meta */}
      <p className="text-sm text-muted-foreground mb-1">
        {[account.category, account.email, account.phone].filter(Boolean).join(' · ')}
      </p>
      {account.description && (
        <p className="text-sm text-foreground/70 mb-5">{account.description}</p>
      )}

      <div id="pipelines" className="scroll-mt-6 border-t pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Pipelines</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplateBrowser(true)}>
              <LayoutTemplate size={13} />
              From Template
            </Button>
            <Button size="sm" onClick={() => setShowCreatePipeline(true)}>
              <Plus size={13} />
              New Pipeline
            </Button>
          </div>
        </div>

        {pipelinesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : pipelines.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No pipelines"
            description="Add a pipeline to start building AI workflows."
            action={{ label: 'New Pipeline', onClick: () => setShowCreatePipeline(true) }}
          />
        ) : (
          <div className="space-y-1.5">
            {pipelines.map((pipeline) => {
              const isConfirmingDelete = pipelinePendingDelete === pipeline.id
              const isDeleting = isConfirmingDelete && deletePipeline.isPending

              return (
                <div
                  key={pipeline.id}
                  className="flex items-center rounded border bg-surface hover:bg-muted/40 transition-colors group"
                >
                  <Link
                    to={`/accounts/${account.slug}/pipelines/${pipeline.slug}`}
                    className="flex min-w-0 flex-1 items-center justify-between px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pipeline.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pipeline.agentCount} {pipeline.agentCount === 1 ? 'agent' : 'agents'}
                        {pipeline.lastRunAt
                          ? ` · Last run ${new Date(pipeline.lastRunAt).toLocaleDateString()}`
                          : ' · No runs yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pipeline.category && (
                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground capitalize">
                          {pipeline.category}
                        </span>
                      )}
                      <PipelineStatusBadge status={pipeline.status} />
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1 pr-2">
                    {isConfirmingDelete ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          loading={isDeleting}
                          onClick={() => handleDeletePipeline(pipeline.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => setPipelinePendingDelete(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${pipeline.name}`}
                        title={`Delete ${pipeline.name}`}
                        disabled={deletePipeline.isPending}
                        onClick={() => setPipelinePendingDelete(pipeline.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Research section */}
      <div id="research" className="scroll-mt-6 border-t pt-5 mt-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold">Research</h2>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={researchSyncing}
                disabled={researchSyncing || sync.isPending || activeResearchSources.length === 0}
                onClick={handleSyncResearch}
                title="Check all active research sources"
              >
                <RefreshCw size={13} />
                Check Research Feeds
              </Button>
              <Button size="sm" onClick={() => setShowCreateResearch(true)}>
                <Plus size={13} />
                New Source
              </Button>
            </div>
            {researchSyncProgress && (
              <p className="text-xs text-muted-foreground text-right max-w-xs truncate">
                Checking {researchSyncProgress.completed + 1}/{researchSyncProgress.total}
                {researchSyncProgress.currentSourceName ? ` · ${researchSyncProgress.currentSourceName}` : ''}
              </p>
            )}
          </div>
        </div>

        {researchLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : researchSources.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No research sources"
            description="Add a feed to collect research content and summaries."
            action={{ label: 'New Source', onClick: () => setShowCreateResearch(true) }}
          />
        ) : (
          <div className="space-y-1.5">
            {researchSources.map((source) => {
              const hasNewResults = newResearchSourceIds.has(source.id)
              const isChecking = researchSyncProgress?.currentSourceId === source.id
              const statusInfo = getResearchRowStatus(source, hasNewResults)

              return (
                <Link
                  key={source.id}
                  to={`/accounts/${account.slug}/research/${source.slug}`}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded border bg-surface hover:bg-muted/40 transition-colors group',
                    statusInfo.rowClass,
                    isChecking && 'border-blue-300 bg-blue-50/50',
                  )}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={cn('h-8 w-8 rounded flex items-center justify-center shrink-0', statusInfo.iconClass)}>
                      <Video size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.itemCount ?? 0} {source.sourceType === 'youtube' ? 'video' : source.sourceType === 'reddit' ? 'digest' : 'article'}{(source.itemCount ?? 0) !== 1 ? 's' : ''}
                        {source.lastChecked
                          ? ` · Checked ${new Date(source.lastChecked).toLocaleDateString()}`
                          : ' · Never checked'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap max-w-[48%]">
                    {isChecking && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
                        Checking
                      </span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', statusInfo.badgeClass)}>
                      {statusInfo.label}
                    </span>
                    {source.category && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground capitalize">
                        {source.category}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${source.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {source.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {showEditAccount && (
        <AccountFormDialog account={account} onClose={() => setShowEditAccount(false)} />
      )}
      {showCreatePipeline && (
        <CreatePipelineDialog
          accountId={account.id}
          accountSlug={account.slug}
          onClose={() => setShowCreatePipeline(false)}
        />
      )}
      {showTemplateBrowser && (
        <TemplateBrowser
          accountId={account.id}
          accountSlug={account.slug}
          onClose={() => setShowTemplateBrowser(false)}
        />
      )}
      {showCreateResearch && (
        <CreateResearchSourceDialog
          accountId={account.id}
          accountSlug={account.slug}
          onClose={() => setShowCreateResearch(false)}
        />
      )}
      {syncResult && (
        <SyncResultDialog
          result={syncResult}
          researchOnly={syncResultResearchOnly}
          onClose={() => setSyncResult(null)}
        />
      )}
    </div>
  )
}

function getResearchRowStatus(source: components['schemas']['ResearchSource'], hasNewResults: boolean) {
  if (hasNewResults) {
    return {
      label: 'New results',
      rowClass: 'border-green-200 bg-green-50/50 hover:bg-green-50',
      iconClass: 'bg-green-100 text-green-700',
      badgeClass: 'bg-green-100 text-green-700',
    }
  }

  if ((source.itemCount ?? 0) > 0) {
    return {
      label: 'Has results',
      rowClass: 'border-sky-100 bg-sky-50/30 hover:bg-sky-50/60',
      iconClass: 'bg-sky-100 text-sky-700',
      badgeClass: 'bg-sky-100 text-sky-700',
    }
  }

  return {
    label: source.lastChecked ? 'No results' : 'Never checked',
    rowClass: 'border-dashed',
    iconClass: 'bg-muted text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  }
}

function SyncResultDialog({ result, researchOnly, onClose }: { result: SyncResult; researchOnly?: boolean; onClose: () => void }) {
  const totalNew = result.research.newItems
  const totalStarted = result.pipelines.started
  const totalResearchErrors = result.research.results.filter((r) => r.error).length
  const showPipelineSummary = !researchOnly || result.pipelines.results.length > 0
  const researchSummaryLabel = researchOnly ? 'feed' : 'source'
  const researchSummaryVerb = researchOnly ? 'processed' : 'attempted'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">Sync Complete</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary chips */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted font-medium">
              <RefreshCw size={11} />
              {result.research.checked} {researchSummaryLabel}{result.research.checked !== 1 ? 's' : ''} {researchSummaryVerb}
            </div>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${totalNew > 0 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              <CheckCircle2 size={11} />
              {totalNew} new item{totalNew !== 1 ? 's' : ''}
            </div>
            {totalResearchErrors > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                <AlertCircle size={11} />
                {totalResearchErrors} issue{totalResearchErrors !== 1 ? 's' : ''}
              </div>
            )}
            {showPipelineSummary && (
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${totalStarted > 0 ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                <Zap size={11} />
                {totalStarted} pipeline{totalStarted !== 1 ? 's' : ''} started
              </div>
            )}
          </div>

          {/* Research results */}
          {result.research.results.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Research</p>
              <div className="space-y-1.5">
                {result.research.results.map((r) => (
                  <div key={r.sourceId} className="flex items-start gap-2 text-xs">
                    {r.error ? (
                      <AlertCircle size={13} className="text-destructive shrink-0 mt-0.5" />
                    ) : r.newItem ? (
                      <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5" />
                    ) : r.updatedCount && r.updatedCount > 0 ? (
                      <RefreshCw size={13} className="text-blue-600 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{r.sourceName}</span>
                      {r.statusMessage ? (
                        <span className={r.error ? ' text-destructive' : ' text-muted-foreground'}> — {r.statusMessage}</span>
                      ) : (
                        <>
                          {r.newItem && r.itemTitle && (
                            <span className="text-muted-foreground"> — {r.itemTitle}</span>
                          )}
                          {!r.newItem && !r.error && r.updatedCount && r.updatedCount > 0 && (
                            <span className="text-muted-foreground"> — refreshed</span>
                          )}
                          {!r.newItem && !r.error && !r.updatedCount && (
                            <span className="text-muted-foreground"> — no new items</span>
                          )}
                          {r.error && (
                            <span className="text-destructive"> — {r.error}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline results */}
          {result.pipelines.results.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipelines</p>
              <div className="space-y-1.5">
                {result.pipelines.results.map((r) => (
                  <div key={r.pipelineId} className="flex items-start gap-2 text-xs">
                    {r.status === 'started' ? (
                      <Zap size={13} className="text-blue-600 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{r.pipelineName}</span>
                      {r.status === 'started' ? (
                        <span className="text-muted-foreground"> — run started</span>
                      ) : (
                        <span className="text-muted-foreground"> — {r.reason ?? 'skipped'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.research.results.length === 0 && result.pipelines.results.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing to sync — no active sources or ready pipelines.</p>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
