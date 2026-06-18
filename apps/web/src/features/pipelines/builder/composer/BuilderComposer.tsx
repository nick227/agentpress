import { ArrowDown, ArrowUp, Image, Type } from 'lucide-react'
import type { components } from '@project/sdk'
import { useUpdatePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'

type Pipeline = components['schemas']['Pipeline']

interface ComposerRow {
  id: string
  type: 'agent_output'
  agentUid: string
  include: boolean
}

interface Props {
  pipeline: Pipeline
  pipelineId: string
}

export function BuilderComposer({ pipeline, pipelineId }: Props) {
  const update = useUpdatePipeline()
  const rows = getRows(pipeline)

  async function save(nextRows: ComposerRow[]) {
    await update.mutateAsync({ pipelineId, bodyComposer: nextRows.map((row) => ({ ...row })) })
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [row] = next.splice(index, 1)
    if (!row) return
    next.splice(target, 0, row)
    save(next)
  }

  function toggle(row: ComposerRow) {
    save(rows.map((item) => item.id === row.id ? { ...item, include: !item.include } : item))
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Body Composer</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Arrange existing text and image outputs. Reordering or excluding rows does not run AI.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border rounded p-4 text-sm text-muted-foreground">
          Add body or inline image agents to compose the final document body.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const agent = pipeline.agents.find((item) => item.uid === row.agentUid)
            if (!agent) return null
            const isImage = agent.outputTarget === 'image'
            return (
              <div key={row.id} className={`border rounded px-3 py-2 flex items-center gap-3 ${row.include ? 'bg-surface' : 'bg-muted/30 opacity-60'}`}>
                <span className="text-muted-foreground shrink-0">
                  {isImage ? <Image size={14} /> : <Type size={14} />}
                </span>
                <button type="button" onClick={() => toggle(row)} className="text-left min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{agent.name}</span>
                  <span className="block text-xs text-muted-foreground font-mono truncate">
                    {row.include ? 'Included' : 'Excluded'} · {agent.uid}
                  </span>
                </button>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp size={13} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(index, 1)} disabled={index === rows.length - 1}>
                    <ArrowDown size={13} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getRows(pipeline: Pipeline): ComposerRow[] {
  const eligibleAgents = pipeline.agents.filter((agent) => agent.outputTarget === 'body' || agent.outputTarget === 'image')
  const existingRows = Array.isArray(pipeline.bodyComposer) ? pipeline.bodyComposer as unknown as ComposerRow[] : []
  const rows = existingRows
    .filter((row) => eligibleAgents.some((agent) => agent.uid === row.agentUid))
    .map((row) => ({ ...row, type: 'agent_output' as const, include: row.include !== false }))

  for (const agent of eligibleAgents) {
    if (!rows.some((row) => row.agentUid === agent.uid)) {
      rows.push({ id: agent.uid, type: 'agent_output', agentUid: agent.uid, include: true })
    }
  }

  return rows
}
