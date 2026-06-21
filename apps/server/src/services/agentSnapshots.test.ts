import { describe, expect, it } from 'vitest'
import { appendAgentDefinitionToPipelineInputs } from '@project/content'

const definition = {
  sourceAgentId: 'catalog-agent',
  defaultUid: 'writer',
  name: 'Writer',
  kind: 'AI_TEXT' as const,
  systemPrompt: 'System',
  userPrompt: 'User',
  outputTarget: 'body' as const,
  outputFormat: 'markdown' as const,
}

describe('Agent insertion snapshots', () => {
  it('assigns unique pipeline-local UIDs and preserves source provenance', () => {
    let agents = appendAgentDefinitionToPipelineInputs([], definition)
    agents = appendAgentDefinitionToPipelineInputs(agents, definition)
    agents = appendAgentDefinitionToPipelineInputs(agents, definition)
    expect(agents.map((agent) => agent.uid)).toEqual(['writer', 'writer_2', 'writer_3'])
    expect(agents.every((agent) => agent.sourceAgentId === 'catalog-agent')).toBe(true)
  })

  it('inserts static-image Agents without a reusable selected asset', () => {
    const [agent] = appendAgentDefinitionToPipelineInputs([], {
      ...definition,
      kind: 'STATIC_IMAGE',
      defaultUid: 'logo',
      outputFormat: 'static',
      outputTarget: 'image',
    })
    expect(agent).toMatchObject({ kind: 'STATIC_IMAGE', selectedImageAssetId: null })
  })
})
