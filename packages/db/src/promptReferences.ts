/**
 * Prompt reference taxonomy:
 *
 * {ziptrader.summary}   feed/resource lookup
 * {context}             pipeline variable
 * {row.title}           dataset row field
 * {outline.output}      prior pipeline node output
 * {writer.body}         prior pipeline node shaped output (outputTarget field)
 *
 * Legacy (warn, still resolve):
 * {agents.outline.output}  → {outline.output}
 * {research.summary}       → {feed_slug.summary}
 *
 * Dotted reference root resolution order:
 * 1. Pipeline node UID from this run
 * 2. Feed/resource key (workspace, then community)
 * 3. Variable / row path
 */

export const RESEARCH_FEED_FIELDS = new Set([
  'summary',
  'date',
  'publishedAt',
  'title',
  'url',
  'content',
  'sourceName',
  'sourceType',
])

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const PROMPT_REF_PATTERN = /\{([^}]+)\}/g

export type PromptReferenceKind =
  | 'node'
  | 'feed'
  | 'variable'
  | 'row'
  | 'legacy_research'
  | 'legacy_agents'

export type PromptReferenceContext = {
  agentUids: Set<string>
  feedSlugs: Set<string>
  communityFeedSlugs: Set<string>
  variableKeys: Set<string>
}

export type ClassifiedPromptReference = {
  ref: string
  normalizedRef: string
  kind: PromptReferenceKind
  feedSlug?: string
  nodeUid?: string
  field?: string
  variableKey?: string
  legacyAgents?: boolean
}

export type PromptReferenceIssue = {
  level: 'error' | 'warning'
  code:
    | 'unknown_feed'
    | 'unknown_node'
    | 'unknown_variable'
    | 'legacy_research'
    | 'legacy_agents'
    | 'community_feed_missing'
    | 'uid_feed_collision'
  message: string
  ref: string
  agentUid?: string
}

type PromptAgent = {
  uid?: string
  name?: string
  systemPrompt: string
  userPrompt: string
}

export function normalizePromptReference(ref: string): { normalized: string; legacyAgents: boolean } {
  if (ref.startsWith('agents.')) {
    return { normalized: ref.slice('agents.'.length), legacyAgents: true }
  }
  return { normalized: ref, legacyAgents: false }
}

export function extractPromptReferences(text: string): string[] {
  return [...text.matchAll(PROMPT_REF_PATTERN)].map((match) => match[1]!).filter(Boolean)
}

function isFeedDottedRef(parts: string[]): boolean {
  const [, second, third] = parts
  return Boolean(
    (second && RESEARCH_FEED_FIELDS.has(second))
    || (second && third && DATE_KEY.test(second) && RESEARCH_FEED_FIELDS.has(third)),
  )
}

export function classifyPromptReference(
  ref: string,
  ctx?: PromptReferenceContext,
): ClassifiedPromptReference {
  if (ref === 'research' || ref.startsWith('research.')) {
    return { ref, normalizedRef: ref, kind: 'legacy_research' }
  }

  const { normalized, legacyAgents } = normalizePromptReference(ref)

  if (normalized.includes('.')) {
    const parts = normalized.split('.')
    const [root] = parts
    if (!root) {
      return { ref, normalizedRef: normalized, kind: 'variable', variableKey: normalized, legacyAgents }
    }

    if (root === 'row') {
      return { ref, normalizedRef: normalized, kind: 'row', legacyAgents }
    }

    if (ctx?.agentUids.has(root)) {
      return {
        ref,
        normalizedRef: normalized,
        kind: 'node',
        nodeUid: root,
        field: parts.slice(1).join('.') || 'output',
        legacyAgents,
      }
    }

    if (isFeedDottedRef(parts)) {
      return {
        ref,
        normalizedRef: normalized,
        kind: 'feed',
        feedSlug: root,
        legacyAgents,
      }
    }
  }

  return {
    ref,
    normalizedRef: normalized,
    kind: 'variable',
    variableKey: normalized,
    legacyAgents,
  }
}

export function extractFeedSlugRefs(
  text: string,
  agentUids: Set<string> = new Set(),
): Array<{ slug: string; ref: string }> {
  const refs: Array<{ slug: string; ref: string }> = []
  for (const ref of extractPromptReferences(text)) {
    const classified = classifyPromptReference(ref, { agentUids, feedSlugs: new Set(), communityFeedSlugs: new Set(), variableKeys: new Set() })
    if (classified.kind === 'feed' && classified.feedSlug) {
      refs.push({ slug: classified.feedSlug, ref: classified.normalizedRef })
    }
  }
  return refs
}

export function assertFeedReferencesValid(
  researchSlugs: Set<string>,
  agents: PromptAgent[],
  agentUids: Set<string> = new Set(),
) {
  for (const agent of agents) {
    const text = `${agent.systemPrompt}\n${agent.userPrompt}`
    for (const { slug, ref } of extractFeedSlugRefs(text, agentUids)) {
      if (!researchSlugs.has(slug)) {
        throw new Error(`Invalid feed reference {${ref}} in agent "${agent.uid ?? agent.name}"`)
      }
    }
  }
}

type AuditPromptReferencesInput = {
  agents: Array<{ uid: string; systemPrompt: string; userPrompt: string }>
  variableKeys: Set<string>
  researchSourceSlugs: Set<string>
  communitySourceSlugs: Set<string>
  agentUids: Set<string>
}

export function auditPromptReferences(input: AuditPromptReferencesInput): PromptReferenceIssue[] {
  const issues: PromptReferenceIssue[] = []
  const allFeedSlugs = new Set([...input.researchSourceSlugs, ...input.communitySourceSlugs])
  const ctx: PromptReferenceContext = {
    agentUids: input.agentUids,
    feedSlugs: input.researchSourceSlugs,
    communityFeedSlugs: input.communitySourceSlugs,
    variableKeys: input.variableKeys,
  }

  for (const uid of input.agentUids) {
    if (allFeedSlugs.has(uid)) {
      issues.push({
        level: 'error',
        code: 'uid_feed_collision',
        ref: uid,
        message: `Pipeline node UID "${uid}" collides with a feed/resource key. Rename the node or use a different feed.`,
      })
    }
  }

  for (const agent of input.agents) {
    const text = `${agent.systemPrompt}\n${agent.userPrompt}`
    for (const ref of extractPromptReferences(text)) {
      const classified = classifyPromptReference(ref, ctx)

      if (classified.legacyAgents) {
        issues.push({
          level: 'warning',
          code: 'legacy_agents',
          ref,
          agentUid: agent.uid,
          message: `Agent "${agent.uid}" uses legacy "${ref}". Use {${classified.normalizedRef}} instead.`,
        })
      }

      if (classified.kind === 'legacy_research') {
        issues.push({
          level: 'warning',
          code: 'legacy_research',
          ref,
          agentUid: agent.uid,
          message: `Agent "${agent.uid}" uses legacy {research} reference which is deprecated. Use the specific feed slug instead, e.g. {feed_slug.summary}`,
        })
        continue
      }

      if (classified.kind === 'node') {
        if (classified.nodeUid && !input.agentUids.has(classified.nodeUid)) {
          issues.push({
            level: 'warning',
            code: 'unknown_node',
            ref,
            agentUid: agent.uid,
            message: `Agent "${agent.uid}" references unknown prior node "${classified.nodeUid}"`,
          })
        }
        continue
      }

      if (classified.kind === 'feed') {
        const slug = classified.feedSlug!
        if (input.communitySourceSlugs.has(slug) && !input.researchSourceSlugs.has(slug)) {
          issues.push({
            level: 'error',
            code: 'community_feed_missing',
            ref,
            agentUid: agent.uid,
            message: `Agent "${agent.uid}" references community feed "${slug}". Add it to this workspace before running.`,
          })
        } else if (!input.researchSourceSlugs.has(slug)) {
          issues.push({
            level: 'warning',
            code: 'unknown_feed',
            ref,
            agentUid: agent.uid,
            message: `Agent "${agent.uid}" references unknown research feed "${slug}"`,
          })
        }
        continue
      }

      if (classified.kind === 'row') continue

      if (classified.kind === 'variable' && classified.variableKey && !input.variableKeys.has(classified.variableKey)) {
        issues.push({
          level: 'warning',
          code: 'unknown_variable',
          ref,
          agentUid: agent.uid,
          message: `Agent "${agent.uid}" references unknown variable "${classified.variableKey}"`,
        })
      }
    }
  }

  return issues
}
