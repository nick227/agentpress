import type {
  AgentDefinition,
  AgentImageMode,
  AgentOutputFormat,
  AgentOutputTarget,
  PipelineAgentInputLike,
} from './types'

interface DefinitionSource {
  uid?: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  systemPrompt: string
  userPrompt: string
  outputTarget: AgentOutputTarget | string
  outputFormat?: AgentOutputFormat | string
  imageMode?: AgentImageMode | string
}

interface PipelineAgentSource extends DefinitionSource {
  uid: string
  outputFormat: AgentOutputFormat | string
  enabled?: boolean
  sortOrder?: number
  selectedImageAssetId?: string | null
}

interface PipelineInputOptions {
  uid?: string
  fallbackUid?: string
  sortOrder: number
  enabled?: boolean
  selectedImageAssetId?: string | null
}

const OUTPUT_TARGETS = new Set<string>([
  'none',
  'title',
  'excerpt',
  'body',
  'image',
  'thumbnail',
  'thumbnail_prompt',
])

const OUTPUT_FORMATS = new Set<string>(['text', 'markdown', 'json', 'image', 'static'])
const IMAGE_MODES = new Set<string>(['generate', 'selected', 'none'])

export function resolveAgentUid(base: string | undefined, taken: Iterable<string>): string {
  const fallback = base?.trim() || 'agent'
  const existing = new Set(taken)
  if (!existing.has(fallback)) return fallback

  let n = 2
  while (existing.has(`${fallback}_${n}`)) n++
  return `${fallback}_${n}`
}

export function agentDefinitionToPipelineInput(
  definition: AgentDefinition,
  options: PipelineInputOptions,
): PipelineAgentInputLike {
  const outputFormat = normalizeOutputFormat(definition.outputFormat)

  return {
    uid: options.uid ?? definition.uid ?? options.fallbackUid ?? 'agent',
    name: definition.name,
    systemPrompt: definition.systemPrompt,
    userPrompt: definition.userPrompt,
    outputTarget: normalizeOutputTarget(definition.outputTarget),
    outputFormat,
    imageMode: normalizeImageMode(definition.imageMode, outputFormat),
    selectedImageAssetId: options.selectedImageAssetId ?? null,
    enabled: options.enabled ?? true,
    sortOrder: options.sortOrder,
  }
}

export function pipelineAgentToPipelineInput(agent: PipelineAgentSource): PipelineAgentInputLike {
  return agentDefinitionToPipelineInput(
    pipelineAgentToDefinition(agent),
    {
      uid: agent.uid,
      sortOrder: agent.sortOrder ?? 0,
      enabled: agent.enabled ?? true,
      selectedImageAssetId: agent.selectedImageAssetId ?? null,
    },
  )
}

export function appendAgentDefinitionToPipelineInputs(
  agents: PipelineAgentSource[],
  definition: AgentDefinition,
): PipelineAgentInputLike[] {
  const uid = resolveAgentUid(definition.uid, agents.map((agent) => agent.uid))

  return [
    ...agents.map(pipelineAgentToPipelineInput),
    agentDefinitionToPipelineInput(definition, {
      uid,
      sortOrder: agents.length,
    }),
  ]
}

export function pipelineAgentToDefinition(agent: PipelineAgentSource): AgentDefinition {
  return toDefinition(agent)
}

export function libraryAgentToDefinition(agent: DefinitionSource): AgentDefinition {
  return toDefinition(agent)
}

export function templateAgentToDefinition(agent: DefinitionSource): AgentDefinition {
  return toDefinition(agent)
}

function toDefinition(source: DefinitionSource): AgentDefinition {
  const outputFormat = normalizeOutputFormat(source.outputFormat)

  return {
    uid: source.uid,
    name: source.name,
    description: source.description,
    category: source.category,
    tags: source.tags,
    systemPrompt: source.systemPrompt,
    userPrompt: source.userPrompt,
    outputTarget: normalizeOutputTarget(source.outputTarget),
    outputFormat,
    imageMode: normalizeImageMode(source.imageMode, outputFormat),
  }
}

function normalizeOutputTarget(value: string): AgentOutputTarget {
  return OUTPUT_TARGETS.has(value) ? (value as AgentOutputTarget) : 'body'
}

function normalizeOutputFormat(value: string | undefined): AgentOutputFormat {
  return value && OUTPUT_FORMATS.has(value) ? (value as AgentOutputFormat) : 'text'
}

function normalizeImageMode(
  value: AgentImageMode | string | undefined,
  outputFormat: AgentOutputFormat,
): Exclude<AgentImageMode, null> {
  if (typeof value === 'string' && IMAGE_MODES.has(value)) {
    return value as Exclude<AgentImageMode, null>
  }
  if (outputFormat === 'static') return 'selected'
  if (outputFormat === 'image') return 'generate'
  return 'generate'
}
