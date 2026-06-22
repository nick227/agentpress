import type { AgentKind, AgentOutputTarget, AgentOutputFormat, AgentImageMode } from '@project/content'

export type UserFacingNodeType = 
  | 'Title Writer' 
  | 'Body Section' 
  | 'Thumbnail Prompt' 
  | 'Thumbnail Image' 
  | 'Excerpt' 
  | 'Static Title'
  | 'Static Body'
  | 'Static Excerpt'
  | 'Static Thumbnail Prompt'
  | 'Static Image' 
  | 'Research Note'

export function getNodeType(kind: AgentKind, outputTarget: AgentOutputTarget): UserFacingNodeType {
  if (kind === 'STATIC_IMAGE') return 'Static Image'
  if (kind === 'AI_IMAGE') return 'Thumbnail Image'
  if (kind === 'STATIC_TEXT') {
    if (outputTarget === 'title') return 'Static Title'
    if (outputTarget === 'excerpt') return 'Static Excerpt'
    if (outputTarget === 'thumbnail_prompt') return 'Static Thumbnail Prompt'
    return 'Static Body'
  }
  
  switch (outputTarget) {
    case 'title': return 'Title Writer'
    case 'body': return 'Body Section'
    case 'thumbnail_prompt': return 'Thumbnail Prompt'
    case 'excerpt': return 'Excerpt'
    case 'none': return 'Research Note'
    default: return 'Body Section' // Fallback
  }
}

export function getDefaultConfigForType(type: UserFacingNodeType): {
  kind: AgentKind
  outputTarget: AgentOutputTarget
  outputFormat: AgentOutputFormat
  imageMode?: Exclude<AgentImageMode, null>
} {
  switch (type) {
    case 'Title Writer':
      return { kind: 'AI_TEXT', outputTarget: 'title', outputFormat: 'markdown' }
    case 'Body Section':
      return { kind: 'AI_TEXT', outputTarget: 'body', outputFormat: 'markdown' }
    case 'Thumbnail Prompt':
      return { kind: 'AI_TEXT', outputTarget: 'thumbnail_prompt', outputFormat: 'text' }
    case 'Thumbnail Image':
      return { kind: 'AI_IMAGE', outputTarget: 'image', outputFormat: 'image', imageMode: 'generate' }
    case 'Excerpt':
      return { kind: 'AI_TEXT', outputTarget: 'excerpt', outputFormat: 'markdown' }
    case 'Static Title':
      return { kind: 'STATIC_TEXT', outputTarget: 'title', outputFormat: 'static' }
    case 'Static Body':
      return { kind: 'STATIC_TEXT', outputTarget: 'body', outputFormat: 'static' }
    case 'Static Excerpt':
      return { kind: 'STATIC_TEXT', outputTarget: 'excerpt', outputFormat: 'static' }
    case 'Static Thumbnail Prompt':
      return { kind: 'STATIC_TEXT', outputTarget: 'thumbnail_prompt', outputFormat: 'static' }
    case 'Static Image':
      return { kind: 'STATIC_IMAGE', outputTarget: 'image', outputFormat: 'static' }
    case 'Research Note':
      return { kind: 'AI_TEXT', outputTarget: 'none', outputFormat: 'markdown' }
  }
}

export function generateUid() {
  return Math.random().toString(36).substring(2, 9)
}
