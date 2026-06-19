import type { AgentDefinition, AgentOutputFormat, AgentOutputTarget } from './agents/types'

export interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean'
  required: boolean
  defaultValue?: string
  exampleValue?: string
  hint?: string
}

export interface TemplateAgent extends Omit<AgentDefinition, 'uid' | 'outputTarget' | 'outputFormat'> {
  uid: string
  outputTarget: AgentOutputTarget
  outputFormat: AgentOutputFormat
  sortOrder: number
}

export interface ContentTemplate {
  id: string
  name: string
  description: string
  category: string
  categoryLabel: string
  tags: string[]
  variables: TemplateVariable[]
  agents: TemplateAgent[]
}

export interface PackVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean'
  required: boolean
  defaultValue?: string
  exampleValue?: string
  hint?: string
}

export interface VariablePack {
  id: string
  name: string
  description: string
  category: string
  categoryLabel: string
  variables: PackVariable[]
}
