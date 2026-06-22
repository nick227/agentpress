import { useState } from 'react'
import type { components } from '@project/sdk'
import { WorkflowNodeCard, type EditorNode } from './WorkflowNodeCard'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getDefaultConfigForType, generateUid, type UserFacingNodeType } from './nodeTypes'

type Pipeline = components['schemas']['Pipeline']

interface Props {
  nodes: EditorNode[]
  pipeline?: Pipeline
  onUpdateNodes: (newNodes: EditorNode[]) => Promise<void>
  readOnly?: boolean
}

const NODE_TYPES: UserFacingNodeType[] = [
  'Title Writer',
  'Body Section',
  'Thumbnail Prompt',
  'Thumbnail Image',
  'Excerpt',
  'Static Title',
  'Static Body',
  'Static Excerpt',
  'Static Thumbnail Prompt',
  'Static Image',
  'Research Note',
]

export function BuilderWorkflowEditor({ nodes, pipeline, onUpdateNodes, readOnly }: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  async function handleAddNode(type: UserFacingNodeType) {
    if (readOnly) return
    const config = getDefaultConfigForType(type)
    const newNode: any = {
      uid: generateUid(),
      name: `New ${type}`,
      kind: config.kind,
      outputTarget: config.outputTarget,
      outputFormat: config.outputFormat,
      imageMode: config.imageMode || 'none',
      systemPrompt: '',
      userPrompt: '',
      enabled: true,
      sortOrder: nodes.length,
    }
    
    let newNodes = [...nodes]
    if (type === 'Research Note') {
      newNodes = [newNode, ...newNodes]
    } else {
      newNodes = [...newNodes, newNode]
    }

    newNodes = newNodes.map((n, i) => ({ ...n, sortOrder: i }))
    await onUpdateNodes(newNodes)
  }

  async function handleDuplicate(index: number) {
    if (readOnly) return
    const nodeToDup = nodes[index]
    if (!nodeToDup) return
    const dup: any = {
      ...nodeToDup,
      id: undefined,
      uid: generateUid(),
      name: `${nodeToDup.name} (Copy)`,
      sortOrder: index + 1,
    }
    const newNodes = [...nodes]
    newNodes.splice(index + 1, 0, dup)
    newNodes.forEach((n, i) => { n.sortOrder = i })
    await onUpdateNodes(newNodes)
  }

  async function handleDelete(index: number) {
    if (readOnly) return
    const newNodes = nodes.filter((_, i) => i !== index)
    newNodes.forEach((n, i) => { n.sortOrder = i })
    await onUpdateNodes(newNodes)
  }

  async function handleToggle(index: number) {
    if (readOnly) return
    const newNodes = nodes.map((n, i) =>
      i === index ? { ...n, enabled: !n.enabled } : n
    )
    await onUpdateNodes(newNodes)
  }

  async function handleDrop(targetIndex: number) {
    if (readOnly || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      return
    }
    const newNodes = [...nodes]
    const [moved] = newNodes.splice(draggedIndex, 1)
    newNodes.splice(targetIndex, 0, moved!)
    newNodes.forEach((n, i) => { n.sortOrder = i })
    await onUpdateNodes(newNodes)
    setDraggedIndex(null)
  }

  async function handleUpdateNode(index: number, updates: Partial<EditorNode>) {
    if (readOnly) return
    const newNodes = nodes.map((n, i) =>
      i === index ? { ...n, ...updates } : n
    )
    await onUpdateNodes(newNodes as EditorNode[])
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Workflow Editor</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the content-generation structure. Visual order matches execution order.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {nodes.length === 0 ? (
          <div className="text-center p-8 border rounded border-dashed text-muted-foreground">
            No workflow nodes yet. Add one to start.
          </div>
        ) : (
          nodes.map((node, index) => (
            <div 
              key={node.uid}
              draggable={!readOnly}
              onDragStart={(e) => {
                if (readOnly) return e.preventDefault()
                setDraggedIndex(index)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (readOnly) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                if (readOnly) return
                e.preventDefault()
                handleDrop(index)
              }}
              className={`transition-opacity ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
            >
              <WorkflowNodeCard 
                node={node}
                pipeline={pipeline}
                index={index}
                executionNumber={index + 1}
                onDuplicate={() => handleDuplicate(index)}
                onDelete={() => handleDelete(index)}
                onToggle={() => handleToggle(index)}
                onUpdate={(updates) => handleUpdateNode(index, updates)}
              />
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium mb-3">Add Node</h3>
          <div className="flex flex-wrap gap-2">
            {NODE_TYPES.map((type) => (
              <Button 
                key={type} 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddNode(type)}
              >
                <Plus size={13} className="mr-1" /> {type}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
