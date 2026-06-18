import type { ContentTemplate, VariablePack } from './types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const blogTemplates: ContentTemplate[] = require('../data/templates/blog.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const socialTemplates: ContentTemplate[] = require('../data/templates/social.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ecommerceTemplates: ContentTemplate[] = require('../data/templates/ecommerce.json')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const seoVariablePacks: VariablePack[] = require('../data/variable-packs/seo.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const styleVariablePacks: VariablePack[] = require('../data/variable-packs/style.json')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const productVariablePacks: VariablePack[] = require('../data/variable-packs/product.json')

const ALL_TEMPLATES: ContentTemplate[] = [
  ...blogTemplates,
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
