import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient } from '../client'

export function useCommunityPipelines() {
  return useQuery({
    queryKey: ['community-pipelines'],
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/community/pipelines')
      if (error) throw error
      return ((data as any)?.data ?? []) as any[]
    },
  })
}

export function useCommunityFeeds() {
  return useQuery({
    queryKey: ['community-feeds'],
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/community/feeds')
      if (error) throw error
      return ((data as any)?.data ?? []) as any[]
    },
  })
}

export function useForkCommunityPipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const { data, error } = await getApiClient().POST('/api/community/pipelines/{pipelineId}/fork', {
        params: { path: { pipelineId } }, body: {},
      })
      if (error) throw error
      return (data as any)?.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelines'] }),
  })
}

export function useSubscribeCommunityFeed() {
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await getApiClient().POST('/api/community/feeds/{sourceId}/subscribe', {
        params: { path: { sourceId } },
      })
      if (error) throw error
      return (data as any)?.data
    },
  })
}
