import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Bot, ChevronDown, ChevronRight, Globe2, Image, Layers, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflow, useDeleteWorkflow, useUpdateWorkflow } from '@project/sdk'
import type { components } from '@project/sdk'
import { BuilderWorkflowEditor } from '@/features/pipelines/builder/workflow/BuilderWorkflowEditor'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

type WorkflowNode = components['schemas']['WorkflowNode']

const KIND_ICON: Record<string, React.ReactNode> = {
  AI_IMAGE: <Image size={12} />,
  STATIC_IMAGE: <Image size={12} />,
}

const KIND_LABEL: Record<string, string> = {
  AI_TEXT: 'AI Text',
  AI_IMAGE: 'AI Image',
  STATIC_TEXT: 'Static Text',
  STATIC_IMAGE: 'Static Image',
}

export function WorkflowDetailPage() {
  const { workflowId = '' } = useParams()
  const navigate = useNavigate()
  const { data: response, isLoading } = useWorkflow(workflowId)
  const workflow = response?.data
  const deleteWorkflow = useDeleteWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function handleDelete() {
    try {
      await deleteWorkflow.mutateAsync(workflowId)
      toast.success('Workflow deleted')
      navigate('/workflows')
    } catch {
      toast.error('Failed to delete workflow')
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

          {!isCommunity && (
            <div className="flex shrink-0 items-center gap-2">
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
            </div>
          )}
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
    </div>
  )
}
