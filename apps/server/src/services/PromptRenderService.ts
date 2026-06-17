type AgentOutput = Record<string, string>

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
        return String(variables[ref] ?? '')
      }
      return match
    })
  }
}
