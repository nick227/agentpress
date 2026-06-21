import { useAgents, useAllRuns, useDestinations, usePipelines, usePrompts, useResearchSources, useSchedules } from '@project/sdk'

// Owns the five lightweight resource-list queries used by the global explorer.
export function useExplorerResources() {
  const pipelinesQuery = usePipelines()
  const agentsQuery = useAgents()
  const schedulesQuery = useSchedules()
  const researchQuery = useResearchSources()
  const destinationsQuery = useDestinations()
  const promptsQuery = usePrompts()
  const runsQuery = useAllRuns(30)

  return {
    pipelines: pipelinesQuery.data?.data ?? [],
    agents: agentsQuery.data?.data ?? [],
    schedules: schedulesQuery.data?.data ?? [],
    researchSources: researchQuery.data?.data ?? [],
    destinations: destinationsQuery.data?.data ?? [],
    prompts: promptsQuery.data?.data ?? [],
    runs: runsQuery.data?.data ?? [],
    pipelinesFetching: pipelinesQuery.isFetching,
    agentsFetching: agentsQuery.isFetching,
    schedulesFetching: schedulesQuery.isFetching,
    destinationsFetching: destinationsQuery.isFetching,
    promptsFetching: promptsQuery.isFetching,
    runsFetching: runsQuery.isFetching,
    refreshPipelines: () => void pipelinesQuery.refetch(),
    refreshAgents: () => void agentsQuery.refetch(),
    refreshSchedules: () => void schedulesQuery.refetch(),
    refreshDestinations: () => void destinationsQuery.refetch(),
    refreshPrompts: () => void promptsQuery.refetch(),
    refreshRuns: () => void runsQuery.refetch(),
  }
}
