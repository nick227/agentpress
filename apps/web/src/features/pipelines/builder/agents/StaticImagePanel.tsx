import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import type { components } from '@project/sdk'
import { useImageAssets, useUploadImageAsset } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useSelectAsset } from './useSelectAsset'

type ImageAsset = components['schemas']['ImageAsset']

interface Props {
  pipelineId: string
  agentId: string
  selectedImageAssetId: string
  onSelectAsset: (asset: ImageAsset) => Promise<void>
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export function StaticImagePanel({ pipelineId, agentId, selectedImageAssetId, onSelectAsset }: Props) {
  const upload = useUploadImageAsset()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: imageAssetsData, isLoading } = useImageAssets(pipelineId, agentId)
  const imageAssets = imageAssetsData?.data ?? []
  const { selectingId, handleSelect } = useSelectAsset(onSelectAsset)
  const selectedAsset = imageAssets.find((asset) => asset.id === selectedImageAssetId)
  const busy = upload.isPending || Boolean(selectingId)

  async function handleUpload(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      const dataBase64 = typeof reader.result === 'string' ? reader.result : ''
      if (!dataBase64) {
        toast.error('Could not read image file')
        return
      }
      try {
        const result = await upload.mutateAsync({
          pipelineId,
          agentId,
          dataBase64,
          filename: file.name,
          label: file.name,
        })
        await onSelectAsset(result.data)
        toast.success('Image uploaded')
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      }
    }
    reader.readAsDataURL(file)
  }


  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Upload image
        </Button>
        <p className="text-xs text-muted-foreground">Runs use the selected image below — no AI generation.</p>
      </div>

      {selectedAsset && (
        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Selected for runs</p>
          <img
            src={`${API_BASE_URL}/api/image-assets/${selectedAsset.id}/file`}
            alt={selectedAsset.prompt}
            className="max-h-48 rounded object-contain bg-muted/30"
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Uploaded images</p>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-square w-full rounded" />)}
          </div>
        ) : imageAssets.length === 0 ? (
          <div className="border rounded p-4 text-sm text-muted-foreground flex items-start gap-2">
            <ImageIcon size={16} className="shrink-0 mt-0.5" />
            <p>No images yet. Upload an image to use in pipeline runs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {imageAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={busy || asset.status === 'failed'}
                onClick={() => void handleSelect(asset)}
                className={cn(
                  'relative aspect-square rounded border overflow-hidden text-left transition-colors',
                  selectedImageAssetId === asset.id ? 'ring-2 ring-accent border-accent' : 'hover:border-foreground/30',
                  asset.status === 'failed' && 'opacity-50 cursor-not-allowed',
                )}
              >
                <img
                  src={`${API_BASE_URL}/api/image-assets/${asset.id}/file`}
                  alt={asset.prompt}
                  className="h-full w-full object-cover"
                />
                {selectingId === asset.id && (
                  <span className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
