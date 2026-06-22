import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Bot, CheckCircle2, Clock, Globe2, Image, Layers, Loader2,
  Play, Trash2, XCircle, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflow, useDeleteWorkflow, useUpdateWorkflow, useStartWorkflowRun, useWorkflowRuns } from '@project/sdk'
import type { components } from '@project/sdk'
import { BuilderWorkflowEditor } from '@/features/pipelines/builder/workflow/BuilderWorkflowEditor'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

type WorkflowNode = components['schemas']['WorkflowNode']
type RunSummary = components['schemas']['RunSummary']

// Extract {variable} tokens from all node prompts
function extractVariables(nodes: WorkflowNode[]): string[] {
  const set = new Set<string>()
  for (const node of nodes) {
    const text = `${node.systemPrompt ?? ''} ${node.userPrompt ?? ''}`
    for (const m of text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) {
      set.add(m[1]!)
    }
  }
  return [...set]
}

const STATUS_CONFIG = {
  queued:    { icon: <Clock size={11} />, label: 'Queued',    color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  running:   { icon: <Loader2 size={11} className="animate-spin" />, label: 'Running', color: 'text-blue-500', dot: 'bg-blue-400 animate-pulse' },
  completed: { icon: <CheckCircle2 size={11} />, label: 'Done',  color: 'text-green-600', dot: 'bg-green-500' },
  posted:    { icon: <CheckCircle2 size={11} />, label: 'Done',  color: 'text-green-600', dot: 'bg-green-500' },
  failed:    { icon: <XCircle size={11} />,      label: 'Failed',color: 'text-destructive', dot: 'bg-red-500' },
} as const

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function WorkflowDetailPage() {
  const { workflowId = '' } = useParams()
  const navigate = useNavigate()
  const { data: response, isLoading } = useWorkflow(workflowId)
  const workflow = response?.data
  const deleteWorkflow = useDeleteWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const startRun = useStartWorkflowRun()
  const { data: runsResponse, isLoading: runsLoading } = useWorkflowRuns(workflowId)
  const runs: RunSummary[] = (runsResponse as any)?.data ?? []

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [runVars, setRunVars] = useState<Record<string, string>>({})
  const [dryRun, setDryRun] = useState(true)

  if (isLoading) {
    return (
      <div className="page-shell space-y-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="page-shell">
        <p className="text-sm text-muted-foreground">Workflow not found.</p>
        <Link to="/workflows" className="text-sm text-accent hover:underline mt-2 inline-block">
          Back to Workflows
        </Link>
      </div>
    )
  }

  const isCommunity = workflow.visibility === 'PUBLIC'
  const tags: string[] = Array.isArray(workflow.tags) ? workflow.tags as string[] : []
  const detectedVars = extractVariables(workflow.nodes)

  async function handleDelete() {
    try {
      await deleteWorkflow.mutateAsync(workflowId)
      toast.success('Workflow deleted')
      navigate('/workflows')
    } catch {
      toast.error('Failed to delete workflow')
    }
  }

  async function handleStartRun() {
    try {
      const result = await startRun.mutateAsync({
        workflowId: workflow!.id,
        variables: runVars,
        dryRun,
      })
      toast.success(dryRun ? 'Dry run started' : 'Run started')
      setShowRunDialog(false)
      // Navigate to run detail
      navigate(`/runs/${(result as any).data?.id ?? ''}`)
    } catch {
      toast.error('Failed to start run')
    }
  }

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link
          to="/workflows"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft size={12} /> Workflows
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{workflow.name}</h1>
              {isCommunity && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  community
                </span>
              )}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                {workflow.category}
              </span>
            </div>
            {workflow.description && (
              <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Test Run button */}
            {workflow.nodes.length > 0 && (
              <Button size="sm" onClick={() => setShowRunDialog(true)} disabled={startRun.isPending}>
                <Play size={12} /> Test Workflow
              </Button>
            )}

            {!isCommunity && (
              <>
                {confirmDelete ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={deleteWorkflow.isPending}
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {isCommunity && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Globe2 size={12} />
            <span>Community workflow — read only. Fork it to edit.</span>
            <Link to="/community?tab=workflows" className="text-accent hover:underline">
              Browse community
            </Link>
          </div>
        )}
      </div>

      {/* Run dialog */}
      {showRunDialog && (
        <div className="rounded border bg-surface p-4 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap size={14} /> Configure Run
          </h3>

          {detectedVars.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The following variables were detected in the workflow prompts:
              </p>
              {detectedVars.map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium">{key}</label>
                  <Input
                    value={runVars[key] ?? ''}
                    onChange={(e) => setRunVars((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Value for {${key}}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No variables detected. The workflow will run with static content.</p>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span className="font-medium">Dry run</span>
            <span className="text-xs text-muted-foreground">(no publishing)</span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" loading={startRun.isPending} onClick={handleStartRun}>
              <Zap size={12} /> Start Run
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRunDialog(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="-mx-6">
        <BuilderWorkflowEditor
          nodes={workflow.nodes}
          readOnly={isCommunity}
          onUpdateNodes={async (newNodes: any) => {
            if (isCommunity) return
            await updateWorkflow.mutateAsync({ workflowId: workflow.id, nodes: newNodes })
          }}
        />
      </div>

      {/* Run history */}
      <div className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-semibold">Run History</h2>
        {runsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet. Click "Test Workflow" to start one.</p>
        ) : (
          <div className="divide-y rounded border bg-surface">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.failed
              return (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {run.title || workflow.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {run.dryRun && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          dry
                        </span>
                      )}
                      {run.agentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Bot size={10} /> {run.agentCount}
                        </span>
                      )}
                      {run.assetCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers size={10} /> {run.assetCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{relativeTime(run.startedAt)}</p>
                    <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.color)}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
