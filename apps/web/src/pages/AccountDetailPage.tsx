import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Plus, Pencil, Trash2, Zap, LayoutTemplate, FlaskConical, Video, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useAccount, usePipelines, useDeleteAccount, useResearchSources, useSyncAccount } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountFormDialog } from '@/features/accounts/AccountFormDialog'
import { CreatePipelineDialog } from '@/features/pipelines/CreatePipelineDialog'
import { PipelineStatusBadge } from '@/features/pipelines/PipelineStatusBadge'
import { TemplateBrowser } from '@/features/content/TemplateBrowser'
import { CreateResearchSourceDialog } from '@/features/research/CreateResearchSourceDialog'

type SyncResult = components['schemas']['SyncResult']

export function AccountDetailPage() {
  const { accountSlug } = useParams<{ accountSlug: string }>()
  const navigate = useNavigate()
  const { data: accountData, isLoading: accountLoading } = useAccount(accountSlug!)
  const account = accountData?.data
  const { data: pipelinesData, isLoading: pipelinesLoading } = usePipelines(account?.id ?? '')
  const { data: researchData, isLoading: researchLoading } = useResearchSources(account?.id ?? '')
  const deleteAccount = useDeleteAccount()
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false)
  const [showCreateResearch, setShowCreateResearch] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sync = useSyncAccount()
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const pipelines = pipelinesData?.data ?? []
  const researchSources = researchData?.data ?? []

  async function handleSync() {
    if (!account) return
    try {
      const result = await sync.mutateAsync(account.id)
      setSyncResult(result.data)
    } catch (err: any) {
      toast.error(err.message ?? 'Sync failed')
    }
  }

  async function handleDeleteAccount() {
    if (!account) return
    await deleteAccount.mutateAsync(account.id)
    toast.success('Account deleted')
    navigate('/', { replace: true })
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
          <Button variant="outline" size="sm" loading={sync.isPending} onClick={handleSync} title="Check all active research feeds and run all ready pipelines">
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

      <div className="border-t pt-5">
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
            {pipelines.map((pipeline) => (
              <Link
                key={pipeline.id}
                to={`/accounts/${account.slug}/pipelines/${pipeline.slug}`}
                className="flex items-center justify-between px-4 py-3 rounded border bg-surface hover:bg-muted/40 transition-colors group"
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
            ))}
          </div>
        )}
      </div>

      {/* Research section */}
      <div className="border-t pt-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Research</h2>
          <Button size="sm" onClick={() => setShowCreateResearch(true)}>
            <Plus size={13} />
            New Source
          </Button>
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
            {researchSources.map((source) => (
              <Link
                key={source.id}
                to={`/accounts/${account.slug}/research/${source.slug}`}
                className="flex items-center justify-between px-4 py-3 rounded border bg-surface hover:bg-muted/40 transition-colors group"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <Video size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{source.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.itemCount ?? 0} {source.sourceType === 'youtube' ? 'video' : source.sourceType === 'reddit' ? 'digest' : 'article'}{(source.itemCount ?? 0) !== 1 ? 's' : ''}
                      {source.lastChecked
                        ? ` · Checked ${new Date(source.lastChecked).toLocaleDateString()}`
                        : ' · Never checked'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
            ))}
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
        <SyncResultDialog result={syncResult} onClose={() => setSyncResult(null)} />
      )}
    </div>
  )
}

function SyncResultDialog({ result, onClose }: { result: SyncResult; onClose: () => void }) {
  const totalNew = result.research.newItems
  const totalStarted = result.pipelines.started

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
              {result.research.checked} source{result.research.checked !== 1 ? 's' : ''} checked
            </div>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${totalNew > 0 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              <CheckCircle2 size={11} />
              {totalNew} new item{totalNew !== 1 ? 's' : ''}
            </div>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${totalStarted > 0 ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
              <Zap size={11} />
              {totalStarted} pipeline{totalStarted !== 1 ? 's' : ''} started
            </div>
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
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{r.sourceName}</span>
                      {r.newItem && r.itemTitle && (
                        <span className="text-muted-foreground"> — {r.itemTitle}</span>
                      )}
                      {!r.newItem && !r.error && (
                        <span className="text-muted-foreground"> — no new items</span>
                      )}
                      {r.error && (
                        <span className="text-destructive"> — {r.error}</span>
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
