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

export function useCommunityAgents() {
  return useQuery({
    queryKey: ['community-agents'],
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/community/agents')
      if (error) throw error
      return (data?.data ?? [])
    },
  })
}

export function useForkCommunityAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data, error } = await getApiClient().POST('/api/community/agents/{agentId}/fork', {
        params: { path: { agentId } }, body: {},
      })
      if (error) throw error
      return (data as any)?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['community-agents'] })
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

export function useCommunityPrompts() {
  return useQuery({
    queryKey: ['community-prompts'],
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/community/prompts')
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['community-pipelines'] })
    },
  })
}

export function useForkCommunityFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await getApiClient().POST('/api/community/feeds/{sourceId}/fork', {
        params: { path: { sourceId } },
      })
      if (error) throw error
      return (data as any)?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-sources'] })
      queryClient.invalidateQueries({ queryKey: ['community-feeds'] })
    },
  })
}

export function useForkCommunityPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (promptId: string) => {
      const { data, error } = await getApiClient().POST('/api/community/prompts/{promptId}/fork', {
        params: { path: { promptId } },
      })
      if (error) throw error
      return (data as any)?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['community-prompts'] })
    },
  })
}
