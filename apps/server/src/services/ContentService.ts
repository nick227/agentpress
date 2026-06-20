import {
  agentDefinitionToPipelineInput,
  getTemplates,
  getTemplate,
  getVariablePacks,
  templateAgentToDefinition,
} from '@project/content'
import { PipelineService } from './PipelineService'

const pipelines = new PipelineService()

export class ContentService {
  listTemplates() {
    return getTemplates()
  }

  listVariablePacks() {
    return getVariablePacks()
  }

  async applyTemplate(templateId: string, name?: string) {
    const template = getTemplate(templateId)
    if (!template) throw Object.assign(new Error('Template not found'), { statusCode: 404 })

    const pipeline = await pipelines.create({
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
      agents: template.agents.map((agent) => agentDefinitionToPipelineInput(
        templateAgentToDefinition(agent),
        {
          uid: agent.uid,
          enabled: true,
          sortOrder: agent.sortOrder,
        },
      )),
    })

    return withContent
  }
}
