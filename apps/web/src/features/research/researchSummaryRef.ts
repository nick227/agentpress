import type { components } from '@project/sdk'

type ResearchSource = components['schemas']['ResearchSource']

export function researchSummaryRefHint(source: Pick<ResearchSource, 'pipelineSummaryPromptName' | 'defaultSummaryPromptId'>) {
  const style = source.pipelineSummaryPromptName ?? 'Summary'
  const scope = source.defaultSummaryPromptId ? 'feed default' : 'global default'
  return `Latest item · ${style} (${scope})`
}

export function researchSummaryRefDescription() {
  return 'Uses the latest stored item for this feed, summarized with the pipeline summary style below. Generated on first pipeline run if missing.'
}
