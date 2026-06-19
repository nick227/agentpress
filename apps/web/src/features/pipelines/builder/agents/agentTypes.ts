export function isImageAgent(agent: { outputFormat: string }) {
  return agent.outputFormat === 'image'
}

export function isStaticAgent(agent: { outputFormat: string }) {
  return agent.outputFormat === 'static'
}

export function isImageOutputTarget(target: string) {
  return target === 'thumbnail' || target === 'image'
}

export function agentSublabel(agent: { outputFormat: string; outputTarget: string }) {
  if (isImageAgent(agent)) return `image · ${agent.outputTarget}`
  if (isStaticAgent(agent)) return `static · ${agent.outputTarget}`
  return agent.outputTarget
}
