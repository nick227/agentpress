import { getTemplates, getTemplate, getVariablePacks } from '@project/content'
import { PipelineService } from './PipelineService'

const pipelines = new PipelineService()

export class ContentService {
  listTemplates() {
    return getTemplates()
  }

  listVariablePacks() {
    return getVariablePacks()
  }

  async applyTemplate(templateId: string, accountId: string, name?: string) {
    const template = getTemplate(templateId)
    if (!template) throw Object.assign(new Error('Template not found'), { statusCode: 404 })

    const pipeline = await pipelines.create(accountId, {
      name: name ?? template.name,
      category: template.category,
    })

    const pipelineId = pipeline.id

    const withContent = await pipelines.update(pipelineId, {
      variables: template.variables.map((v, i) => ({
        key: v.key,
        label: v.label,
        type: v.type,
        required: v.required,
        defaultValue: v.defaultValue,
        exampleValue: v.exampleValue,
        sortOrder: i,
      })),
      agents: template.agents.map((a) => ({
        uid: a.uid,
        name: a.name,
        systemPrompt: a.systemPrompt,
        userPrompt: a.userPrompt,
        outputTarget: a.outputTarget,
        outputFormat: a.outputFormat,
        enabled: true,
        sortOrder: a.sortOrder,
      })),
    })

    return withContent
  }
}
