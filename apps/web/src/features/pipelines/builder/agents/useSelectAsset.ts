import { useState } from 'react'
import { toast } from 'sonner'
import type { components } from '@project/sdk'

type ImageAsset = components['schemas']['ImageAsset']

export function useSelectAsset(onSelectAsset: (asset: ImageAsset) => Promise<void>) {
  const [selectingId, setSelectingId] = useState<string | null>(null)

  async function handleSelect(asset: ImageAsset) {
    if (asset.status === 'failed') return
    setSelectingId(asset.id)
    try {
      await onSelectAsset(asset)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not select image')
    } finally {
      setSelectingId(null)
    }
  }

  return { selectingId, handleSelect }
}
