import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Sparkles } from 'lucide-react'
import type { components } from '@project/sdk'
import { useGenerateImageAsset, useImageAssets } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type ImageAsset = components['schemas']['ImageAsset']
type ImageMode = 'selected' | 'generate' | 'none'

interface Props {
  pipelineId: string
  agentId: string
  prompt: string
  imageMode: ImageMode
  selectedImageAssetId: string
  onImageModeChange: (mode: ImageMode) => Promise<void>
  onGenerated: (asset: ImageAsset) => Promise<void>
  onSelectAsset: (asset: ImageAsset) => Promise<void>
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

const MODE_HINTS: Record<ImageMode, string> = {
  selected: 'Pipeline runs use the image you select below.',
  generate: 'Each run generates a fresh image from the prompt above.',
  none: 'This agent produces no image during runs.',
}

type GenPhase = 'idle' | 'generating' | 'saving'

export function ImageAgentPanel({
  pipelineId,
  agentId,
  prompt,
  imageMode,
  selectedImageAssetId,
  onImageModeChange,
  onGenerated,
  onSelectAsset,
}: Props) {
  const generateImage = useGenerateImageAsset()
  const { data: imageAssetsData, isLoading: assetsLoading } = useImageAssets(pipelineId, agentId)
  const imageAssets = imageAssetsData?.data ?? []
  const [phase, setPhase] = useState<GenPhase>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const busy = phase !== 'idle' || generateImage.isPending || Boolean(selectingId)
  const selectedAsset = imageAssets.find((asset) => asset.id === selectedImageAssetId)

  useEffect(() => {
    if (phase === 'idle') {
      setElapsedSec(0)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 500)
    return () => window.clearInterval(timer)
  }, [phase])

  async function handleGenerate() {
    const trimmed = prompt.trim()
    if (!trimmed) {
      toast.error('Image prompt is required')
      return
    }

    setError(null)
    setPhase('generating')
    const toastId = toast.loading('Generating image…', {
      description: 'Sending prompt to the image provider. This usually takes 15–30 seconds.',
    })

    try {
      const result = await generateImage.mutateAsync({ pipelineId, agentId, prompt: trimmed })
      setPhase('saving')
      toast.loading('Saving image…', { id: toastId, description: 'Writing image to your asset library.' })

      await onGenerated(result.data)
      setPhase('idle')
      toast.success('Image ready', {
        id: toastId,
        description: formatAssetMeta(result.data),
      })
    } catch (err: unknown) {
      setPhase('idle')
      const message = err instanceof Error ? err.message : 'Image generation failed'
      setError(message)
      toast.error(message, { id: toastId, duration: 8000 })
    }
  }

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

  const generateLabel = phase === 'saving'
    ? 'Saving…'
    : phase === 'generating'
      ? `Generating… ${elapsedSec}s`
      : 'Generate image'

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <Field label="Image source" className="flex-1">
          <select
            value={imageMode}
            disabled={busy}
            onChange={(e) => onImageModeChange(e.target.value as ImageMode)}
            className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="selected">Use selected image</option>
            <option value="generate">Generate during run</option>
            <option value="none">Skip image</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">{MODE_HINTS[imageMode]}</p>
        </Field>
        <Button
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={busy}
          onClick={handleGenerate}
        >
          {phase !== 'idle'
            ? <Loader2 size={13} className="animate-spin" />
            : <Sparkles size={13} />}
          {generateLabel}
        </Button>
      </div>

      {phase !== 'idle' && (
        <StatusBanner phase={phase} elapsedSec={elapsedSec} prompt={prompt.trim()} />
      )}

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Generation failed</p>
            <p className="mt-1 text-destructive/90">{error}</p>
          </div>
        </div>
      )}

      {selectedAsset && imageMode === 'selected' && (
        <SelectedPreview asset={selectedAsset} />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Generated images</p>
          {!assetsLoading && imageAssets.length > 0 && (
            <span className="text-xs text-muted-foreground">{imageAssets.length} saved</span>
          )}
        </div>

        {assetsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded" />
            ))}
          </div>
        ) : imageAssets.length === 0 && phase === 'idle' ? (
          <div className="border rounded p-4 text-sm text-muted-foreground flex items-start gap-2">
            <ImageIcon size={16} className="shrink-0 mt-0.5" />
            <p>No images yet. Write a prompt above and click Generate image.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {phase === 'generating' && <GeneratingPlaceholder elapsedSec={elapsedSec} />}
            {imageAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selectedImageAssetId === asset.id}
                selecting={selectingId === asset.id}
                disabled={busy}
                onSelect={() => handleSelect(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function StatusBanner({ phase, elapsedSec, prompt }: { phase: Exclude<GenPhase, 'idle'>; elapsedSec: number; prompt: string }) {
  const isSaving = phase === 'saving'
  return (
    <div className="rounded border border-accent/30 bg-accent/5 p-3 flex gap-3 items-start">
      <Loader2 size={16} className="animate-spin text-accent shrink-0 mt-0.5" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">
          {isSaving ? 'Saving to asset library…' : `Generating image (${elapsedSec}s)…`}
        </p>
        <p className="text-xs text-muted-foreground">
          {isSaving
            ? 'Almost done — selecting this image for the agent.'
            : 'Your prompt was sent to the image provider. Large images can take up to a minute.'}
        </p>
        {!isSaving && prompt && (
          <p className="text-xs font-mono text-muted-foreground truncate pt-1" title={prompt}>
            {prompt}
          </p>
        )}
      </div>
    </div>
  )
}

function SelectedPreview({ asset }: { asset: ImageAsset }) {
  return (
    <div className="rounded border border-accent/40 bg-accent/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-accent/20 flex items-center gap-2 text-xs font-medium text-accent">
        <CheckCircle2 size={14} />
        Selected for runs
      </div>
      <div className="p-3 flex gap-3 items-start">
        <img
          src={imageAssetUrl(asset.id)}
          alt=""
          className="w-24 h-24 rounded object-cover bg-muted shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{formatAssetMeta(asset)}</p>
          <p className="text-xs line-clamp-3">{asset.prompt}</p>
        </div>
      </div>
    </div>
  )
}

function GeneratingPlaceholder({ elapsedSec }: { elapsedSec: number }) {
  return (
    <div className="rounded border border-dashed border-accent/40 overflow-hidden bg-accent/5">
      <div className="aspect-square flex flex-col items-center justify-center gap-2 p-3 text-center">
        <Loader2 size={22} className="animate-spin text-accent" />
        <p className="text-xs font-medium">Generating…</p>
        <p className="text-[11px] text-muted-foreground">{elapsedSec}s</p>
      </div>
    </div>
  )
}

function AssetCard({
  asset,
  selected,
  selecting,
  disabled,
  onSelect,
}: {
  asset: ImageAsset
  selected: boolean
  selecting: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const failed = asset.status === 'failed'
  return (
    <button
      type="button"
      disabled={disabled || failed || selecting}
      onClick={onSelect}
      className={cn(
        'text-left rounded border overflow-hidden transition-colors disabled:opacity-60',
        selected ? 'border-accent ring-2 ring-accent/30 bg-accent/5' : 'border-input-border hover:bg-muted/30',
        failed && 'border-destructive/30 bg-destructive/5',
      )}
    >
      {failed ? (
        <div className="aspect-square flex items-center justify-center p-3 bg-destructive/5">
          <AlertCircle size={24} className="text-destructive" />
        </div>
      ) : (
        <img
          src={imageAssetUrl(asset.id)}
          alt=""
          className="w-full aspect-square object-cover bg-muted"
        />
      )}
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-medium truncate">
            {selecting ? 'Selecting…' : selected ? 'Selected' : failed ? 'Failed' : 'Image'}
          </p>
          {selecting && <Loader2 size={12} className="animate-spin shrink-0" />}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{formatAssetMeta(asset)}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{failed ? asset.error ?? asset.prompt : asset.prompt}</p>
      </div>
    </button>
  )
}

function formatAssetMeta(asset: ImageAsset): string {
  const parts = [asset.model, asset.size, formatTinyDate(asset.createdAt)].filter(Boolean)
  return parts.join(' · ')
}

function formatTinyDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function imageAssetUrl(assetId: string) {
  return `${API_BASE_URL}/api/image-assets/${assetId}/file`
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
