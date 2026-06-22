import { useState } from 'react'
import type { components } from '@project/sdk'
import { useCreatePrompt } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PromptField } from '@/features/pipelines/builder/agents/PromptField'
import { ChevronDown, ChevronRight, GripVertical, Trash2, Copy, FileText, Image, Bot, FlaskConical, LayoutTemplate } from 'lucide-react'
import { getNodeType } from './nodeTypes'
import { cn } from '@/lib/utils'

type PipelineAgent = components['schemas']['PipelineAgent']
type WorkflowNode = components['schemas']['WorkflowNode']
type Pipeline = components['schemas']['Pipeline']

export type EditorNode = PipelineAgent | WorkflowNode

interface Props {
  node: EditorNode
  pipeline?: Pipeline
  index: number
  executionNumber: number
  onDuplicate: () => void
  onDelete: () => void
  onToggle: () => void
  onUpdate: (updates: Partial<EditorNode>) => Promise<void>
}

function getNodeIcon(type: string) {
  if (type.includes('Image') || type.includes('Thumbnail')) return <Image size={14} />
  if (type.includes('Title') || type.includes('Excerpt')) return <LayoutTemplate size={14} />
  if (type.includes('Research')) return <FlaskConical size={14} />
  if (type.includes('Static')) return <FileText size={14} />
  return <Bot size={14} />
}

export function WorkflowNodeCard({ node, pipeline, index, executionNumber, onDuplicate, onDelete, onToggle, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(node.name)
  const [systemPrompt, setSystemPrompt] = useState(node.systemPrompt)
  const [userPrompt, setUserPrompt] = useState(node.userPrompt)

  const nodeType = getNodeType(node.kind, node.outputTarget)
  const isStatic = node.kind.startsWith('STATIC')
  const createPrompt = useCreatePrompt()

  async function handleSaveSystemPrompt(name: string) {
    await createPrompt.mutateAsync({ name, category: 'Uncategorized', systemPrompt, userPrompt: '' })
  }

  async function handleSaveUserPrompt(name: string) {
    await createPrompt.mutateAsync({ name, category: 'Uncategorized', systemPrompt: '', userPrompt })
  }

  async function handleSave() {
    await onUpdate({
      name,
      systemPrompt,
      userPrompt,
    })
  }

  return (
    <div className={cn("border rounded bg-surface shadow-sm transition-all", expanded && "ring-1 ring-border", !node.enabled && "opacity-60")}>
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 p-2 px-3">
        <button type="button" className="cursor-grab hover:text-foreground text-muted-foreground"><GripVertical size={14} /></button>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-medium text-muted-foreground">{executionNumber}</span>
        
        <button 
          type="button" 
          onClick={() => setExpanded(!expanded)} 
          className="flex flex-1 items-center gap-3 min-w-0 text-left hover:bg-muted/40 p-1 -ml-1 rounded"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium px-1.5 py-0.5 bg-muted text-muted-foreground rounded shrink-0">
            {getNodeIcon(nodeType)} {nodeType}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">{name}</span>
          </div>
          {!expanded && !isStatic && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px] shrink block">
              {userPrompt || systemPrompt || 'Empty prompt'}
            </span>
          )}
          {expanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <label className="flex items-center gap-2 text-xs cursor-pointer px-2">
            <input type="checkbox" checked={node.enabled} onChange={onToggle} className="rounded" />
            {node.enabled ? 'Enabled' : 'Disabled'}
          </label>
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate} title="Duplicate node"><Copy size={13} /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} className="text-red-500 hover:text-red-600" title="Delete node"><Trash2 size={13} /></Button>
        </div>
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="p-4 border-t space-y-4 bg-muted/10">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Node Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={handleSave} className="max-w-md" />
          </div>

          {!isStatic && (
            <>
              <PromptField
                label="System Prompt"
                value={systemPrompt}
                onChange={setSystemPrompt}
                onSave={handleSave}
                promptKind="system"
                pipeline={pipeline}
                agent={node as PipelineAgent}
                defaultSaveName={`${name} - System`}
                savingPrompt={createPrompt.isPending}
                onSavePrompt={handleSaveSystemPrompt}
              />
              <PromptField
                label="User Prompt"
                value={userPrompt}
                onChange={setUserPrompt}
                onSave={handleSave}
                promptKind="user"
                pipeline={pipeline}
                agent={node as PipelineAgent}
                defaultSaveName={`${name} - User`}
                savingPrompt={createPrompt.isPending}
                onSavePrompt={handleSaveUserPrompt}
              />
            </>
          )}

          {isStatic && (
            <PromptField
              label="Content"
              value={userPrompt}
              onChange={setUserPrompt}
              onSave={handleSave}
              promptKind="user"
              pipeline={pipeline}
              agent={node as PipelineAgent}
              defaultSaveName={`${name} - Content`}
              savingPrompt={createPrompt.isPending}
              onSavePrompt={handleSaveUserPrompt}
            />
          )}
        </div>
      )}
    </div>
  )
}
