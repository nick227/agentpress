import { useState } from 'react'
import { usePipelineRun, usePublishRun } from '@project/sdk'
import type { components } from '@project/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, XCircle, Loader2, Clock, FileCode, Image, Send, Download, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadRunAsset } from '@/lib/downloadRunAsset'
import { toast } from 'sonner'

type Pipeline = components['schemas']['Pipeline']

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

export function BuilderRun({ runId, pipeline }: Props) {
  const { data, isLoading } = usePipelineRun(runId)
  const publish = usePublishRun()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
  const downloadAssets = [...(data?.assets ?? [])]
    .filter((a) => a.type === 'image' || a.type === 'html')
    .sort((a, b) => assetSortOrder(a.filename, a.type) - assetSortOrder(b.filename, b.type))
  const publishAttempts = data?.publishAttempts ?? []

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
    try {
      const result = await publish.mutateAsync(runId)
      toast.success(result.remoteUrl ? `Published to ${result.remoteUrl}` : 'Published successfully')
    } catch (err: any) {
      toast.error(err.message ?? 'Publish failed')
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
    <div className="p-6 max-w-2xl space-y-6">
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
            loading={publish.isPending}
            onClick={handlePublish}
          >
            <Send size={13} />
            Publish to WordPress
          </Button>
        )}
      </div>

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
                <img src={post.thumbnailUrl} alt="Generated thumbnail" className="rounded max-w-sm w-full" />
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

      {/* Publish attempts */}
      {publishAttempts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Publishing</h2>
          {publishAttempts.map((attempt) => (
            <div key={attempt.id} className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                {attempt.status === 'success' ? (
                  <CheckCircle2 size={14} className="text-green-600" />
                ) : attempt.status === 'failed' ? (
                  <XCircle size={14} className="text-destructive" />
                ) : (
                  <Clock size={14} className="text-muted-foreground" />
                )}
                <span className="capitalize">{attempt.status}</span>
              </div>
              {attempt.remoteUrl && (
                <a
                  href={attempt.remoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {attempt.remoteUrl}
                </a>
              )}
              {attempt.error && <p className="text-xs text-destructive">{attempt.error}</p>}
            </div>
          ))}
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
                  {ar.outputText && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-40 overflow-y-auto">
                      {ar.outputText}
                    </pre>
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
