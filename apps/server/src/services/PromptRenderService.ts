type AgentOutput = Record<string, string>

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
  render(
    template: string,
    variables: Record<string, unknown>,
    agentOutputs: AgentOutput,
  ): string {
    return template.replace(/\{([^}]+)\}/g, (match, ref: string) => {
      if (ref.startsWith('agents.')) {
        const parts = ref.split('.')
        const uid = parts[1]
        if (uid && uid in agentOutputs) {
          return agentOutputs[uid] ?? match
        }
        return match
      }
      if (ref in variables) {
        return stringify(variables[ref]) ?? match
      }
      if (ref.includes('.')) {
        const [root, ...path] = ref.split('.')
        if (root && root in variables) {
          return stringify(resolvePath(variables[root], path)) ?? match
        }
      }
      return match
    })
  }
}
