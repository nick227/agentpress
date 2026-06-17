import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Plus, Pencil, Trash2, Zap } from 'lucide-react'
import { useAccount, usePipelines, useCreatePipeline, useDeleteAccount } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountFormDialog } from '@/features/accounts/AccountFormDialog'
import { CreatePipelineDialog } from '@/features/pipelines/CreatePipelineDialog'
import { PipelineStatusBadge } from '@/features/pipelines/PipelineStatusBadge'

export function AccountDetailPage() {
  const { accountSlug } = useParams<{ accountSlug: string }>()
  const navigate = useNavigate()
  const { data: accountData, isLoading: accountLoading } = useAccount(accountSlug!)
  const account = accountData?.data
  const { data: pipelinesData, isLoading: pipelinesLoading } = usePipelines(account?.id ?? '')
  const deleteAccount = useDeleteAccount()
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pipelines = pipelinesData?.data ?? []

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
          <Button size="sm" onClick={() => setShowCreatePipeline(true)}>
            <Plus size={13} />
            New Pipeline
          </Button>
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
                <PipelineStatusBadge status={pipeline.status} />
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
    </div>
  )
}
