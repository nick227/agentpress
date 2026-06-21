import type { ContentTemplate, VariablePack } from './types'
import blogTemplatesData from '../data/templates/blog.json'
import socialTemplatesData from '../data/templates/social.json'
import ecommerceTemplatesData from '../data/templates/ecommerce.json'
import scriptTemplatesData from '../data/templates/scripts.json'
import storyTemplatesData from '../data/templates/stories.json'
import sketchTemplatesData from '../data/templates/sketches.json'
import coldEmailTemplatesData from '../data/templates/cold-emails.json'
import nicheTemplatesData from '../data/templates/niche.json'
import resumeTemplatesData from '../data/templates/resumes.json'
import commercialTemplatesData from '../data/templates/commercials.json'
import tweetTemplatesData from '../data/templates/tweets.json'
import seoVariablePacksData from '../data/variable-packs/seo.json'
import styleVariablePacksData from '../data/variable-packs/style.json'
import productVariablePacksData from '../data/variable-packs/product.json'

const blogTemplates = blogTemplatesData as ContentTemplate[]
const socialTemplates = socialTemplatesData as ContentTemplate[]
const ecommerceTemplates = ecommerceTemplatesData as ContentTemplate[]
const scriptTemplates = scriptTemplatesData as ContentTemplate[]
const storyTemplates = storyTemplatesData as ContentTemplate[]
const sketchTemplates = sketchTemplatesData as ContentTemplate[]
const coldEmailTemplates = coldEmailTemplatesData as ContentTemplate[]
const nicheTemplates = nicheTemplatesData as ContentTemplate[]
const resumeTemplates = resumeTemplatesData as ContentTemplate[]
const commercialTemplates = commercialTemplatesData as ContentTemplate[]
const tweetTemplates = tweetTemplatesData as ContentTemplate[]

const seoVariablePacks = seoVariablePacksData as VariablePack[]
const styleVariablePacks = styleVariablePacksData as VariablePack[]
const productVariablePacks = productVariablePacksData as VariablePack[]

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
  AgentKind,
  AgentOutputFormat,
  AgentOutputTarget,
  PipelineAgentInputLike,
} from './agents/types'
export {
  appendAgentDefinitionToPipelineInputs,
  inferAgentKind,
  agentDefinitionToPipelineInput,
  libraryAgentToDefinition,
  promptToDefinition,
  pipelineAgentToPipelineInput,
  pipelineAgentToDefinition,
  resolveAgentUid,
  templateAgentToDefinition,
} from './agents/mappers'
export { BUILTIN_AGENT_DEFINITIONS } from './agents/builtins'
