import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export function RowDeleteControls({
  isConfirming,
  isDeleting,
  onConfirm,
  onCancel,
  onDelete,
}: {
  isConfirming: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
  onDelete: () => Promise<void>
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 pr-3 transition-opacity',
        !isConfirming && 'opacity-0 group-hover:opacity-100',
      )}
    >
      {isConfirming ? (
        <>
          <Button variant="destructive" size="sm" loading={isDeleting} onClick={onDelete}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={onConfirm}>
          ✕
        </Button>
      )}
    </div>
  )
}

export function useDeleteConfirm({
  mutateAsync,
  isPending,
}: {
  mutateAsync: (id: string) => Promise<unknown>
  isPending: boolean
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function propsFor(id: string, label: string) {
    return {
      isConfirming: confirmId === id,
      isDeleting: isPending && confirmId === id,
      onConfirm: () => setConfirmId(id),
      onCancel: () => setConfirmId(null),
      onDelete: async () => {
        try {
          await mutateAsync(id)
          toast.success(`${label} deleted`)
        } catch {
          toast.error('Delete failed')
        }
        setConfirmId(null)
      },
    }
  }

  return { propsFor }
}
