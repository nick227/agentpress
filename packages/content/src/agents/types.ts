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

export interface AgentDefinition {
  uid?: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  systemPrompt: string
  userPrompt: string
  outputTarget: AgentOutputTarget
  outputFormat?: AgentOutputFormat
  imageMode?: AgentImageMode
}

export interface PipelineAgentInputLike {
  id?: string
  uid: string
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
