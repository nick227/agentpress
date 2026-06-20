import { useDestinations, usePipelines, useResearchSources, useSchedules } from '@project/sdk'

// Owns the four lightweight resource-list queries used by the global explorer.
export function useExplorerResources() {
  const pipelinesQuery = usePipelines()
  const schedulesQuery = useSchedules()
  const researchQuery = useResearchSources()
  const destinationsQuery = useDestinations()

  return {
    pipelines: pipelinesQuery.data?.data ?? [],
    schedules: schedulesQuery.data?.data ?? [],
    researchSources: researchQuery.data?.data ?? [],
    destinations: destinationsQuery.data?.data ?? [],
    pipelinesFetching: pipelinesQuery.isFetching,
    schedulesFetching: schedulesQuery.isFetching,
    destinationsFetching: destinationsQuery.isFetching,
    refreshPipelines: () => void pipelinesQuery.refetch(),
    refreshSchedules: () => void schedulesQuery.refetch(),
    refreshDestinations: () => void destinationsQuery.refetch(),
  }
}
