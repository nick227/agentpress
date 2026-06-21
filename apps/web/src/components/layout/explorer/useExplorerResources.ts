import { useAllRuns, useDestinations, usePipelines, useResearchSources, useSchedules } from '@project/sdk'

// Owns the five lightweight resource-list queries used by the global explorer.
export function useExplorerResources() {
  const pipelinesQuery = usePipelines()
  const schedulesQuery = useSchedules()
  const researchQuery = useResearchSources()
  const destinationsQuery = useDestinations()
  const runsQuery = useAllRuns(30)

  return {
    pipelines: pipelinesQuery.data?.data ?? [],
    schedules: schedulesQuery.data?.data ?? [],
    researchSources: researchQuery.data?.data ?? [],
    destinations: destinationsQuery.data?.data ?? [],
    runs: runsQuery.data?.data ?? [],
    pipelinesFetching: pipelinesQuery.isFetching,
    schedulesFetching: schedulesQuery.isFetching,
    destinationsFetching: destinationsQuery.isFetching,
    runsFetching: runsQuery.isFetching,
    refreshPipelines: () => void pipelinesQuery.refetch(),
    refreshSchedules: () => void schedulesQuery.refetch(),
    refreshDestinations: () => void destinationsQuery.refetch(),
    refreshRuns: () => void runsQuery.refetch(),
  }
}
