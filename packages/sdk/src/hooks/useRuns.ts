import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function usePipelineRun(runId: string, options?: { pollForPublish?: boolean }) {
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
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      if (typeof document !== 'undefined' && document.hidden) return false
      if (options?.pollForPublish) return 1500

      const status = query.state.data?.data?.status
      if (status !== 'queued' && status !== 'running') return false

      const startedAt = query.state.data?.data?.startedAt
      const elapsed = startedAt ? Date.now() - new Date(startedAt).getTime() : 0
      const steps = Math.floor(elapsed / 30_000)
      return Math.min(2000 * 2 ** steps, 8000)
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
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}
