import { useState } from 'react'
import { Plus, Settings, Variable, Clock, CheckCircle2, XCircle, Loader2, Package, BookOpen, Image, FileText } from 'lucide-react'
import {
  BUILTIN_AGENT_DEFINITIONS,
  appendAgentDefinitionToPipelineInputs,
  type AgentDefinition,
} from '@project/content'
import type { components } from '@project/sdk'
import { useUpdatePipeline } from '@project/sdk'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { usePipelineSelection } from '@/features/pipelines/builder/pipelineSelectionContext'
import { VariablePackPicker } from '@/features/content/VariablePackPicker'
import { AgentLibraryBrowser } from '@/features/library/AgentLibraryBrowser'
import { agentSublabel } from './agents/agentTypes'

type Pipeline = components['schemas']['Pipeline']
type Run = components['schemas']['PipelineRun']

interface Props {
  pipeline: Pipeline
  runs: Run[]
  pipelineId: string
}

const RUN_STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock size={12} className="text-muted-foreground" />,
  running: <Loader2 size={12} className="text-accent animate-spin" />,
  completed: <CheckCircle2 size={12} className="text-green-500" />,
  posted: <CheckCircle2 size={12} className="text-green-600" />,
  failed: <XCircle size={12} className="text-destructive" />,
}

export function BuilderSidebar({ pipeline, runs, pipelineId }: Props) {
  const { selection, onSelect } = usePipelineSelection()
  const update = useUpdatePipeline()
  const [showPackPicker, setShowPackPicker] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  async function addVariable() {
    const newVar = {
      id: undefined,
      key: `var_${pipeline.variables.length + 1}`,
      label: '',
      type: 'text' as const,
      required: false,
      sortOrder: pipeline.variables.length,
    }
    const result = await update.mutateAsync({
      pipelineId,
      variables: [
        ...pipeline.variables.map((v) => ({
          id: v.id,
          key: v.key,
          label: v.label,
          type: v.type as any,
          required: v.required,
          defaultValue: v.defaultValue,
          exampleValue: v.exampleValue,
          sortOrder: v.sortOrder,
        })),
        newVar,
      ],
    })
    const addedVar = result.data.variables[result.data.variables.length - 1]
    if (addedVar) onSelect({ type: 'variable', id: addedVar.id })
  }

  async function addAgentDefinition(definition: AgentDefinition) {
    const result = await update.mutateAsync({
      pipelineId,
      agents: appendAgentDefinitionToPipelineInputs(pipeline.agents, definition),
    })
    const addedAgent = result.data.agents[result.data.agents.length - 1]
    if (addedAgent) onSelect({ type: 'agent', id: addedAgent.id })
  }

  async function addImageAgent() {
    await addAgentDefinition(BUILTIN_AGENT_DEFINITIONS.blankImage)
  }

  async function addStaticAgent() {
    await addAgentDefinition(BUILTIN_AGENT_DEFINITIONS.staticImage)
  }

  async function addAgent() {
    await addAgentDefinition(BUILTIN_AGENT_DEFINITIONS.blankText)
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {/* Setup */}
      <SidebarItem
        label="Setup"
        icon={<Settings size={13} />}
        active={selection.type === 'setup'}
        onClick={() => onSelect({ type: 'setup' })}
      />

      {/* Variables */}
      <div className="px-3 pt-4 pb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variables</span>
        <div className="flex">
          <Button variant="ghost" size="icon-sm" onClick={() => setShowPackPicker(true)} title="Import variable pack">
            <Package size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={addVariable} title="Add variable">
            <Plus size={13} />
          </Button>
        </div>
      </div>
      {pipeline.variables.map((v) => (
        <SidebarItem
          key={v.id}
          label={v.label || v.key}
          sublabel={`{${v.key}}`}
          icon={<Variable size={13} />}
          active={selection.type === 'variable' && selection.id === v.id}
          onClick={() => onSelect({ type: 'variable', id: v.id })}
        />
      ))}
      {pipeline.variables.length === 0 && (
        <p className="px-4 py-1.5 text-xs text-muted-foreground">No variables</p>
      )}

      {/* Agents */}
      <div className="px-3 pt-4 pb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agents</span>
        <div className="flex">
          <Button variant="ghost" size="icon-sm" onClick={() => setShowLibrary(true)} title="Browse agent library">
            <BookOpen size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={addImageAgent} title="Add image agent">
            <Image size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={addStaticAgent} title="Add static agent">
            <FileText size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={addAgent} title="Add text agent">
            <Plus size={13} />
          </Button>
        </div>
      </div>
      {pipeline.agents.map((a, i) => (
        <SidebarItem
          key={a.id}
          label={a.name}
          sublabel={agentSublabel(a)}
          icon={<span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>}
          active={selection.type === 'agent' && selection.id === a.id}
          onClick={() => onSelect({ type: 'agent', id: a.id })}
          dimmed={!a.enabled}
        />
      ))}
      {pipeline.agents.length === 0 && (
        <p className="px-4 py-1.5 text-xs text-muted-foreground">No agents</p>
      )}

      {showPackPicker && (
        <VariablePackPicker
          pipeline={pipeline}
          pipelineId={pipelineId}
          onClose={() => setShowPackPicker(false)}
        />
      )}

      {showLibrary && (
        <AgentLibraryBrowser
          pipeline={pipeline}
          pipelineId={pipelineId}
          onClose={() => setShowLibrary(false)}
          onAgentAdded={(id) => onSelect({ type: 'agent', id })}
        />
      )}

      {/* Runs */}
      <div className="px-3 pt-4 pb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Runs</span>
      </div>
      {runs.length === 0 ? (
        <p className="px-4 py-1.5 text-xs text-muted-foreground">No runs yet</p>
      ) : (
        runs.slice(0, 10).map((run, i) => (
          <SidebarItem
            key={run.id}
            label={run.title || `Run ${runs.length - i}`}
            sublabel={`${run.dryRun ? 'Dry' : 'Live'} · ${new Date(run.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            icon={RUN_STATUS_ICON[run.status] ?? <Clock size={12} />}
            active={selection.type === 'run' && selection.id === run.id}
            onClick={() => onSelect({ type: 'run', id: run.id })}
          />
        ))
      )}
    </div>
  )
}

function SidebarItem({
  label,
  sublabel,
  icon,
  active,
  onClick,
  dimmed,
}: {
  label: string
  sublabel?: string
  icon?: React.ReactNode
  active?: boolean
  onClick: () => void
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors',
        active ? 'bg-accent/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
        dimmed && 'opacity-50'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium truncate">{label}</span>
        {sublabel && <span className="block text-xs text-muted-foreground truncate font-mono">{sublabel}</span>}
      </span>
    </button>
  )
}
