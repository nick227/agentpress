import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, ChevronRight } from 'lucide-react'
import { useAccounts } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { AccountFormDialog } from '@/features/accounts/AccountFormDialog'

export function AccountsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useAccounts()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const accounts = (data?.data ?? []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">Accounts</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          New Account
        </Button>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Create your first account to start building pipelines."
          action={{ label: 'New Account', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-1.5">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => navigate(`/accounts/${account.slug}`)}
              className="w-full flex items-center justify-between px-4 py-3 rounded border bg-surface hover:bg-muted/40 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2 size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.category ? `${account.category} · ` : ''}
                    {account.pipelineCount} {account.pipelineCount === 1 ? 'pipeline' : 'pipelines'}
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
            </button>
          ))}
        </div>
      )}

      {showCreate && <AccountFormDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
