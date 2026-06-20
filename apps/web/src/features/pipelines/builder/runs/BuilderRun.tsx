import { useEffect, useState } from 'react'
import { useDestinations, usePipelineRun, usePublishRun } from '@project/sdk'
import type { components } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, XCircle, Loader2, Clock, FileCode, Image, Send, Download, FolderOpen, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadRunAsset } from '@/lib/downloadRunAsset'
import { PublishProgressPanel } from './PublishProgressPanel'
import { toast } from 'sonner'

type Pipeline = components['schemas']['Pipeline']
type RunAsset = components['schemas']['RunAsset']
type ImageRunAsset = RunAsset & { id: string; filename: string; type: 'image' }

interface Props {
  runId: string
  pipeline: Pipeline
}

const STATUS_MAP: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  queued: { icon: <Clock size={14} />, label: 'Queued', color: 'text-muted-foreground' },
  running: { icon: <Loader2 size={14} className="animate-spin" />, label: 'Running', color: 'text-accent' },
  completed: { icon: <CheckCircle2 size={14} />, label: 'Completed', color: 'text-green-600' },
  posted: { icon: <CheckCircle2 size={14} />, label: 'Published', color: 'text-green-600' },
  failed: { icon: <XCircle size={14} />, label: 'Failed', color: 'text-destructive' },
}

const ASSET_ICON: Record<string, React.ReactNode> = {
  html: <FileCode size={13} />,
  image: <Image size={13} />,
}

function assetSortOrder(filename: string, type: string): number {
  if (type === 'html' || filename.endsWith('.html')) return 0
  if (filename === 'thumbnail.png') return 1
  return 2
}

const CACHE_STATUS: Record<string, { label: string; className: string }> = {
  generated: { label: 'generated', className: 'bg-blue-100 text-blue-700' },
  reused: { label: 'reused', className: 'bg-green-100 text-green-700' },
  failed: { label: 'failed', className: 'bg-red-100 text-red-700' },
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function isPreviewableImageAsset(asset: RunAsset): asset is ImageRunAsset {
  return asset.type === 'image' && typeof asset.id === 'string' && typeof asset.filename === 'string'
}

const PUBLISH_TOAST_ID = 'wordpress-publish'

export function BuilderRun({ runId, pipeline }: Props) {
  const [publishing, setPublishing] = useState(false)
  const publish = usePublishRun()
  const { data, isLoading } = usePipelineRun(runId, { pollForPublish: publishing || publish.isPending })
  const { data: destinationsData } = useDestinations(pipeline.accountId)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const assets = data?.assets ?? []
  const downloadAssets = [...assets]
    .filter((a) => a.type === 'image' || a.type === 'html')
    .sort((a, b) => assetSortOrder(a.filename, a.type) - assetSortOrder(b.filename, b.type))
  const imageAssets = downloadAssets.filter(isPreviewableImageAsset)
  const publishAttempts = data?.publishAttempts ?? []
  const destination = destinationsData?.data.find((item) => item.id === pipeline.destinationId)
  const isPublishing = publishing || publish.isPending || publishAttempts.some((attempt) => attempt.status === 'pending')

  useEffect(() => {
    if (!isPublishing) return
    const latest = publishAttempts[publishAttempts.length - 1]
    if (latest?.progressMessage) {
      toast.loading(latest.progressMessage, { id: PUBLISH_TOAST_ID })
    }
  }, [isPublishing, publishAttempts])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const run = data?.data
  const agentRuns = data?.agentRuns ?? []

  if (!run) return null

  const statusInfo = STATUS_MAP[run.status] ?? STATUS_MAP.queued!
  const runTitle = run.title || pipeline.name
  const post = run.generatedPost as any
  const isActive = run.status === 'queued' || run.status === 'running'

  const canPublish =
    run.status === 'completed' &&
    run.dryRun &&
    Boolean(pipeline.destinationId) &&
    Boolean(post)

  async function handlePublish() {
    setPublishing(true)
    toast.loading('Starting WordPress publish…', { id: PUBLISH_TOAST_ID })
    try {
      const result = await publish.mutateAsync(runId)
      const details = [
        result.inlineImagesUploaded ? `${result.inlineImagesUploaded} inline image${result.inlineImagesUploaded === 1 ? '' : 's'}` : null,
        result.featuredImageUploaded ? 'featured image' : null,
      ].filter(Boolean)
      toast.success(
        result.remoteUrl
          ? `Published${details.length ? ` · ${details.join(', ')}` : ''}`
          : 'Published successfully',
        {
          id: PUBLISH_TOAST_ID,
          description: result.remoteUrl,
          duration: 10000,
        },
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Publish failed', { id: PUBLISH_TOAST_ID, duration: 10000 })
    } finally {
      setPublishing(false)
    }
  }

  async function handleDownloadAsset(assetId: string, filename: string) {
    setDownloadingId(assetId)
    try {
      await downloadRunAsset(runId, assetId, filename)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-semibold truncate">{runTitle}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn('flex items-center gap-1.5 text-sm font-medium', statusInfo.color)}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {run.dryRun ? 'Dry run' : 'Live run'} · {new Date(run.startedAt).toLocaleString()}
            </span>
            {isActive && (
              <span className="text-xs text-muted-foreground animate-pulse">Refreshing…</span>
            )}
          </div>
        </div>

        {canPublish && (
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            loading={isPublishing}
            disabled={isPublishing}
            onClick={handlePublish}
          >
            <Send size={13} />
            {isPublishing ? 'Publishing…' : 'Publish to WordPress'}
          </Button>
        )}
      </div>

      {(publishAttempts.length > 0 || isPublishing) && (
        <PublishProgressPanel
          attempts={publishAttempts}
          isPublishing={isPublishing}
          destinationSiteUrl={destination?.siteUrl}
        />
      )}

      {run.error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {run.error}
        </div>
      )}

      {/* Generated post */}
      {post && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Generated Post</h2>

          {post.title && (
            <Section title="Title">
              <p className="text-base font-semibold">{post.title}</p>
            </Section>
          )}

          {(post.thumbnailPrompt || post.thumbnailUrl) && (
            <Section title="Thumbnail">
              {post.thumbnailStatus === 'generating' ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground h-32 border rounded bg-muted/20">
                  <Loader2 size={15} className="animate-spin" />
                  Generating image…
                </div>
              ) : post.thumbnailUrl ? (
                <img
                  src={post.thumbnailUrl}
                  alt="Generated thumbnail"
                  loading="lazy"
                  decoding="async"
                  className="rounded max-w-sm w-full"
                />
              ) : post.thumbnailStatus === 'failed' ? (
                <div className="text-sm text-destructive border border-destructive/20 rounded p-3 bg-destructive/5">
                  Image generation failed
                </div>
              ) : post.thumbnailPrompt ? (
                <p className="text-sm text-muted-foreground">{post.thumbnailPrompt}</p>
              ) : null}
            </Section>
          )}

          {post.excerpt && (
            <Section title="Excerpt">
              <p className="text-sm">{post.excerpt}</p>
            </Section>
          )}

          {post.body && (
            <Section title="Body">
              <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed border rounded p-4 bg-muted/20 max-h-96 overflow-y-auto font-mono">
                {post.body}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Image thumbs */}
      {imageAssets.length > 0 && (
        <Section title="Images">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {imageAssets.map((asset) => (
              <ImagePreviewCard
                key={asset.id}
                runId={runId}
                asset={asset}
                downloading={downloadingId === asset.id}
                onDownload={() => handleDownloadAsset(asset.id, asset.filename)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Assets */}
      {downloadAssets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Saved Assets</h2>
          {run.outputFolder && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3 rounded border bg-muted/20 px-3 py-2">
              <FolderOpen size={13} className="mt-0.5 shrink-0" />
              <span className="font-mono break-all truncate whitespace-nowrap">{run.outputFolder}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {downloadAssets.map((asset) => {
              const displayName = asset.filename.includes('/') ? asset.filename.split('/').pop()! : asset.filename
              const isDownloading = downloadingId === asset.id
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleDownloadAsset(asset.id, asset.filename)}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border bg-surface hover:bg-muted/40 hover:border-foreground/20 transition-colors disabled:opacity-60"
                  title={`Download ${asset.filename}`}
                >
                  <span className="text-muted-foreground">{ASSET_ICON[asset.type] ?? <Image size={13} />}</span>
                  <span className="text-accent hover:underline">{displayName}</span>
                  {isDownloading ? (
                    <Loader2 size={11} className="animate-spin text-muted-foreground" />
                  ) : (
                    <Download size={11} className="text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Agent details */}
      {agentRuns.length > 0 && (
        <details>
          <summary className="text-sm font-semibold cursor-pointer select-none">
            Agent Outputs ({agentRuns.length})
          </summary>
          <div className="mt-3 space-y-3">
            {agentRuns.map((ar) => {
              const info = STATUS_MAP[ar.status] ?? STATUS_MAP.queued!
              return (
                <div key={ar.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      {ar.agentName}{' '}
                      <span className="text-muted-foreground font-normal">→ {ar.outputTarget}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      {ar.cacheStatus && (
                        <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium', CACHE_STATUS[ar.cacheStatus]?.className)}>
                          {CACHE_STATUS[ar.cacheStatus]?.label ?? ar.cacheStatus}
                        </span>
                      )}
                      <span className={cn('flex items-center gap-1 text-xs', info.color)}>
                        {info.icon}
                        {info.label}
                      </span>
                    </div>
                  </div>
                  {ar.cacheStatus === 'reused' && ar.reusedFromAgentRunId && (
                    <p className="text-xs text-muted-foreground">Reused from agent run {ar.reusedFromAgentRunId}</p>
                  )}
                  {ar.renderedSystemPrompt?.trim() && (
                    <PromptBlock label="System prompt" text={ar.renderedSystemPrompt} />
                  )}
                  {ar.renderedUserPrompt?.trim() && (
                    <PromptBlock label="User prompt" text={ar.renderedUserPrompt} />
                  )}
                  {ar.outputText && (
                    <PromptBlock label="Output" text={ar.outputText} />
                  )}
                  {ar.error && <p className="text-xs text-destructive">{ar.error}</p>}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

function ImagePreviewCard({
  runId,
  asset,
  downloading,
  onDownload,
}: {
  runId: string
  asset: ImageRunAsset
  downloading: boolean
  onDownload: () => void
}) {
  const [previewFailed, setPreviewFailed] = useState(false)
  const displayName = asset.filename.includes('/') ? asset.filename.split('/').pop()! : asset.filename
  const previewUrl = runAssetUrl(runId, asset.id)

  return (
    <div className="rounded border bg-surface overflow-hidden">
      <div className="relative aspect-square bg-muted/30">
        {previewFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground">
            <Image size={22} />
            <span>Preview unavailable</span>
          </div>
        ) : (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" title={`Open ${displayName}`}>
            <img
              src={previewUrl}
              alt={asset.label || displayName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
            <span className="absolute right-2 top-2 rounded bg-background/85 p-1 text-muted-foreground shadow-sm">
              <ExternalLink size={13} />
            </span>
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={asset.label || displayName}>
            {asset.label || displayName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground" title={asset.filename}>
            {displayName}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="shrink-0 rounded border p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/40 disabled:opacity-60"
          title={`Download ${asset.filename}`}
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        </button>
      </div>
    </div>
  )
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-40 overflow-y-auto font-mono">
        {text}
      </pre>
    </div>
  )
}

function runAssetUrl(runId: string, assetId: string) {
  return `${API_BASE}/api/pipeline-runs/${runId}/assets/${assetId}`
}
