import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function usePipelineRun(runId: string) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/pipeline-runs/{runId}', {
        params: { path: { runId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      return status === 'queued' || status === 'running' ? 2000 : false
    },
  })
}

export function usePublishRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/pipeline-runs/{runId}/publish', {
        params: { path: { runId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: ['run', runId] })
    },
  })
}

export function useStartPipelineRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pipelineId,
      variables,
      dryRun,
      title,
      forceRegenerate,
      forceRegenerateAgentUids,
    }: {
      pipelineId: string
      variables: Record<string, unknown>
      dryRun?: boolean
      title?: string
      forceRegenerate?: boolean
      forceRegenerateAgentUids?: string[]
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/runs', {
        params: { path: { pipelineId } },
        body: { variables, dryRun, title, forceRegenerate, forceRegenerateAgentUids },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
    },
  })
}
