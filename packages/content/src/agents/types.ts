export type AgentOutputTarget =
  | 'none'
  | 'title'
  | 'excerpt'
  | 'body'
  | 'image'
  | 'thumbnail'
  | 'thumbnail_prompt'

export type AgentOutputFormat = 'text' | 'markdown' | 'json' | 'image' | 'static'

export type AgentImageMode = 'generate' | 'selected' | 'none' | null

export type AgentKind = 'AI_TEXT' | 'AI_IMAGE' | 'STATIC_TEXT' | 'STATIC_IMAGE'

export interface AgentDefinition {
  defaultUid?: string
  sourceAgentId?: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  systemPrompt: string
  userPrompt: string
  outputTarget: AgentOutputTarget
  outputFormat?: AgentOutputFormat
  imageMode?: AgentImageMode
  kind?: AgentKind
}

export interface PipelineAgentInputLike {
  id?: string
  sourceAgentId?: string
  uid: string
  kind: AgentKind
  name: string
  systemPrompt: string
  userPrompt: string
  outputTarget: AgentOutputTarget
  outputFormat: AgentOutputFormat
  imageMode?: Exclude<AgentImageMode, null>
  selectedImageAssetId?: string | null
  enabled: boolean
  sortOrder: number
}
