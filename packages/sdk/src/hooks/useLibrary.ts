import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useLibraryAgents(category?: string, search?: string) {
  return useQuery({
    queryKey: ['library-agents', category, search],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/library/agents', {
        params: { query: { category, search } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCreateLibraryAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      uid: string
      name: string
      description?: string
      category: string
      tags?: string[]
      systemPrompt: string
      userPrompt: string
      outputTarget: string
      outputFormat?: string
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/library/agents', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-agents'] })
    },
  })
}

export function useUpdateLibraryAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentId, ...body }: { agentId: string; [k: string]: any }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/library/agents/{agentId}', {
        params: { path: { agentId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-agents'] })
    },
  })
}

export function useDeleteLibraryAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/library/agents/{agentId}', {
        params: { path: { agentId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-agents'] })
    },
  })
}
