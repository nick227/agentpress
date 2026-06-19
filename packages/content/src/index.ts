import type { ContentTemplate, VariablePack } from './types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const blogTemplates: ContentTemplate[] = require('../data/templates/blog.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const socialTemplates: ContentTemplate[] = require('../data/templates/social.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ecommerceTemplates: ContentTemplate[] = require('../data/templates/ecommerce.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scriptTemplates: ContentTemplate[] = require('../data/templates/scripts.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const storyTemplates: ContentTemplate[] = require('../data/templates/stories.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sketchTemplates: ContentTemplate[] = require('../data/templates/sketches.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coldEmailTemplates: ContentTemplate[] = require('../data/templates/cold-emails.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nicheTemplates: ContentTemplate[] = require('../data/templates/niche.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const resumeTemplates: ContentTemplate[] = require('../data/templates/resumes.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const commercialTemplates: ContentTemplate[] = require('../data/templates/commercials.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tweetTemplates: ContentTemplate[] = require('../data/templates/tweets.json')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const seoVariablePacks: VariablePack[] = require('../data/variable-packs/seo.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const styleVariablePacks: VariablePack[] = require('../data/variable-packs/style.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const productVariablePacks: VariablePack[] = require('../data/variable-packs/product.json')

const ALL_TEMPLATES: ContentTemplate[] = [
  ...blogTemplates,
  ...scriptTemplates,
  ...storyTemplates,
  ...sketchTemplates,
  ...coldEmailTemplates,
  ...nicheTemplates,
  ...resumeTemplates,
  ...commercialTemplates,
  ...tweetTemplates,
  ...socialTemplates,
  ...ecommerceTemplates,
]

const ALL_PACKS: VariablePack[] = [
  ...seoVariablePacks,
  ...styleVariablePacks,
  ...productVariablePacks,
]

export function getTemplates(): ContentTemplate[] {
  return ALL_TEMPLATES
}

export function getTemplate(id: string): ContentTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id)
}

export function getVariablePacks(): VariablePack[] {
  return ALL_PACKS
}

export function getVariablePack(id: string): VariablePack | undefined {
  return ALL_PACKS.find((p) => p.id === id)
}

export type { ContentTemplate, VariablePack, TemplateVariable, TemplateAgent, PackVariable } from './types'
export type {
  AgentDefinition,
  AgentImageMode,
  AgentOutputFormat,
  AgentOutputTarget,
  PipelineAgentInputLike,
} from './agents/types'
export {
  appendAgentDefinitionToPipelineInputs,
  agentDefinitionToPipelineInput,
  libraryAgentToDefinition,
  pipelineAgentToPipelineInput,
  pipelineAgentToDefinition,
  resolveAgentUid,
  templateAgentToDefinition,
} from './agents/mappers'
export { BUILTIN_AGENT_DEFINITIONS } from './agents/builtins'
