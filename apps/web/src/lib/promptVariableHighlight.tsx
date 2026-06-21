import type { ReactNode } from 'react'

const VARIABLE_RE = /\{[^}\n]+\}/g

export function renderPromptVariableHighlight(text: string) {
  if (!text) return '\u00a0'

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(VARIABLE_RE.source, 'g')

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    nodes.push(
      <span key={`v-${match.index}`} className="text-accent font-medium">
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return nodes
}
