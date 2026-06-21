export function isImageAgent(agent: { kind?: string; outputFormat: string }) {
  return agent.kind ? agent.kind === 'AI_IMAGE' : agent.outputFormat === 'image'
}

export function isStaticAgent(agent: { kind?: string; outputFormat: string }) {
  return agent.kind ? agent.kind === 'STATIC_TEXT' || agent.kind === 'STATIC_IMAGE' : agent.outputFormat === 'static'
}

export function isImageOutputTarget(target: string) {
  return target === 'thumbnail' || target === 'image'
}

export function agentSublabel(agent: { outputFormat: string; outputTarget: string }) {
  if (isImageAgent(agent)) return `image · ${agent.outputTarget}`
  if (isStaticAgent(agent)) return `static · ${agent.outputTarget}`
  return agent.outputTarget
}
