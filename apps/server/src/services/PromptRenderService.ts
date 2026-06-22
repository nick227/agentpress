import { normalizePromptReference } from '@project/db'

function resolvePath(value: unknown, path: string[]): unknown {
  let current = value
  for (const part of path) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function stringify(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (value === null) return ''
  if (typeof value === 'object') {
    const maybeSummary = (value as Record<string, unknown>).summary
    if (typeof maybeSummary === 'string') return maybeSummary
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export class PromptRenderService {
  render(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, ref: string) => {
      const { normalized } = normalizePromptReference(ref)

      if (normalized in variables) {
        return stringify(variables[normalized]) ?? match
      }

      if (normalized.includes('.')) {
        const [root, ...path] = normalized.split('.')
        if (root && root in variables) {
          return stringify(resolvePath(variables[root], path)) ?? match
        }
      }

      return match
    })
  }
}

export function buildPriorNodeVariables(
  runVariables: Record<string, unknown>,
  agentOutputs: Record<string, string>,
  pipelineAgents: Array<{ uid: string; outputTarget: string }>,
): Record<string, unknown> {
  const renderVariables = { ...runVariables }

  for (const [uid, text] of Object.entries(agentOutputs)) {
    const agent = pipelineAgents.find((item) => item.uid === uid)
    const target = agent?.outputTarget ?? 'output'
    renderVariables[uid] = {
      output: text,
      [target]: text,
    }
  }

  return renderVariables
}
