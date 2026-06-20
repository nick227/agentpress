export function evaluateFreshness(
  policy: string,
  triggerSourceIds: string[],
  successfulSourceIds: Set<string>,
  eligibleBySource: Record<string, string[]>,
) {
  if (policy === 'always') return { shouldRun: true as const }
  const successfulTriggers = triggerSourceIds.filter((sourceId) => successfulSourceIds.has(sourceId))
  if (successfulTriggers.length === 0) {
    return { shouldRun: false as const, reason: 'No research feeds checked successfully' }
  }
  if (successfulTriggers.some((sourceId) => (eligibleBySource[sourceId]?.length ?? 0) > 0)) {
    return { shouldRun: true as const }
  }
  return { shouldRun: false as const, reason: 'No new content' }
}
