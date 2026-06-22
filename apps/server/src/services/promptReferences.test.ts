import { describe, expect, it } from 'vitest'
import {
  assertFeedReferencesValid,
  auditPromptReferences,
  classifyPromptReference,
} from '@project/db'
import { PromptRenderService, buildPriorNodeVariables } from './PromptRenderService'

const ctx = (overrides: Partial<{
  agentUids: string[]
  feedSlugs: string[]
  communityFeedSlugs: string[]
  variableKeys: string[]
}> = {}) => ({
  agentUids: new Set(overrides.agentUids ?? ['outline', 'writer']),
  feedSlugs: new Set(overrides.feedSlugs ?? ['ziptrader']),
  communityFeedSlugs: new Set(overrides.communityFeedSlugs ?? []),
  variableKeys: new Set(overrides.variableKeys ?? ['context']),
})

describe('prompt reference taxonomy', () => {
  it('classifies {ziptrader.summary} as a feed reference', () => {
    expect(classifyPromptReference('ziptrader.summary', ctx()).kind).toBe('feed')
  })

  it('classifies {context} as a variable reference', () => {
    expect(classifyPromptReference('context', ctx()).kind).toBe('variable')
  })

  it('classifies {outline.output} as a prior node reference', () => {
    expect(classifyPromptReference('outline.output', ctx())).toMatchObject({
      kind: 'node',
      nodeUid: 'outline',
      field: 'output',
    })
  })

  it('classifies {writer.body} as a prior node shaped output reference', () => {
    expect(classifyPromptReference('writer.body', ctx())).toMatchObject({
      kind: 'node',
      nodeUid: 'writer',
      field: 'body',
    })
  })

  it('prefers pipeline node UID over feed pattern when both could match', () => {
    expect(classifyPromptReference('ziptrader.summary', ctx({ agentUids: ['ziptrader'] })).kind).toBe('node')
  })

  it('warns on legacy {agents.outline.output} and normalizes to {outline.output}', () => {
    const issues = auditPromptReferences({
      agents: [{ uid: 'writer', systemPrompt: '', userPrompt: 'Prior: {agents.outline.output}' }],
      variableKeys: new Set(),
      researchSourceSlugs: new Set(),
      communitySourceSlugs: new Set(),
      agentUids: new Set(['outline', 'writer']),
    })

    expect(issues.some((issue) => issue.code === 'legacy_agents')).toBe(true)
    expect(classifyPromptReference('agents.outline.output', ctx()).normalizedRef).toBe('outline.output')
  })

  it('validates {ziptrader.summary} as a known feed reference', () => {
    const issues = auditPromptReferences({
      agents: [{ uid: 'writer', systemPrompt: '', userPrompt: 'Source: {ziptrader.summary}' }],
      variableKeys: new Set(),
      researchSourceSlugs: new Set(['ziptrader']),
      communitySourceSlugs: new Set(),
      agentUids: new Set(['writer']),
    })

    expect(issues).toEqual([])
  })

  it('treats {context} as a variable reference, not a feed reference', () => {
    const issues = auditPromptReferences({
      agents: [{ uid: 'bull_case', systemPrompt: '', userPrompt: 'Content:\n{context}' }],
      variableKeys: new Set(['context']),
      researchSourceSlugs: new Set(['ziptrader']),
      communitySourceSlugs: new Set(),
      agentUids: new Set(['bull_case']),
    })

    expect(issues).toEqual([])
    expect(classifyPromptReference('context', ctx()).kind).toBe('variable')
  })

  it('warns on deprecated {research.summary} with replacement guidance', () => {
    const issues = auditPromptReferences({
      agents: [{ uid: 'writer', systemPrompt: '', userPrompt: 'Legacy: {research.summary}' }],
      variableKeys: new Set(),
      researchSourceSlugs: new Set(['ziptrader']),
      communitySourceSlugs: new Set(),
      agentUids: new Set(['writer']),
    })

    expect(issues).toEqual([{
      level: 'warning',
      code: 'legacy_research',
      ref: 'research.summary',
      agentUid: 'writer',
      message: expect.stringContaining('Use the specific feed slug instead, e.g. {feed_slug.summary}'),
    }])
  })

  it('fails seed guardrail when a prompt references an unknown feed slug', () => {
    expect(() => assertFeedReferencesValid(
      new Set(['ziptrader']),
      [{ uid: 'writer', systemPrompt: '', userPrompt: 'Bad feed: {not-a-real-feed.summary}' }],
      new Set(['writer']),
    )).toThrow(/Invalid feed reference \{not-a-real-feed\.summary\}/)
  })

  it('does not treat prior node refs as feed refs during seed validation', () => {
    expect(() => assertFeedReferencesValid(
      new Set(['ziptrader']),
      [{ uid: 'writer', systemPrompt: '', userPrompt: 'Prior: {outline.output}' }],
      new Set(['outline', 'writer']),
    )).not.toThrow()
  })
})

describe('PromptRenderService', () => {
  const renderer = new PromptRenderService()

  it('resolves {outline.output} from prior node variables', () => {
    const variables = buildPriorNodeVariables(
      {},
      { outline: 'Outline text' },
      [{ uid: 'outline', outputTarget: 'body' }],
    )

    expect(renderer.render('Prior:\n{outline.output}', variables)).toBe('Prior:\nOutline text')
    expect(renderer.render('Body:\n{outline.body}', variables)).toBe('Body:\nOutline text')
  })

  it('resolves legacy {agents.outline.output} via normalization', () => {
    const variables = buildPriorNodeVariables(
      {},
      { outline: 'Outline text' },
      [{ uid: 'outline', outputTarget: 'body' }],
    )

    expect(renderer.render('Prior:\n{agents.outline.output}', variables)).toBe('Prior:\nOutline text')
  })

  it('resolves {ziptrader.summary} from feed variables', () => {
    const variables = {
      ziptrader: { summary: 'NVDA bullish', date: '2026-06-21' },
    }

    expect(renderer.render('Feed:\n{ziptrader.summary}', variables)).toBe('Feed:\nNVDA bullish')
  })
})
