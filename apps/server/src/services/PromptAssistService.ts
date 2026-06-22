import { OpenAIService } from './OpenAIService'

const ai = new OpenAIService()

export class PromptAssistService {
  async assist(input: {
    pipelineName: string
    variables?: any[]
    previousAgents?: any[]
    currentAgent?: any
    promptKind: 'system' | 'user'
    currentPrompt?: string
    userInstruction: string
  }) {
    const varList = (input.variables ?? []).map((v: any) => `{${v.key}} (${v.type})`).join(', ')
    const prevAgentList = (input.previousAgents ?? [])
      .map((a: { uid: string; outputTarget?: string }) => `{${a.uid}.output}${a.outputTarget && a.outputTarget !== 'output' ? `, {${a.uid}.${a.outputTarget}}` : ''}`)
      .join(', ')

    const system = `You are a prompt engineering assistant for an AI pipeline builder called AgentPress.
The pipeline is named "${input.pipelineName}".
Available variables: ${varList || 'none'}
Available prior node outputs: ${prevAgentList || 'none'}
You are writing a ${input.promptKind} prompt for an agent${input.currentAgent ? ` named "${input.currentAgent.name}" targeting ${input.currentAgent.outputTarget}` : ''}.
Reference variables using {key} syntax. Reference prior node outputs using {node_uid.output} or {node_uid.body} syntax — never use agents. prefix.
Return ONLY the prompt text — no explanation, no markdown fences.`

    const user = input.currentPrompt
      ? `Current prompt:\n${input.currentPrompt}\n\nInstruction: ${input.userInstruction}`
      : `Instruction: ${input.userInstruction}`

    const suggestedPrompt = await ai.generateText(system, user)

    return { suggestedPrompt: suggestedPrompt.trim(), warnings: [] }
  }
}
