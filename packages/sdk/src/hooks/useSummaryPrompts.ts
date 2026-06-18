import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useSummaryPrompts() {
  return useQuery({
    queryKey: ['summary-prompts'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/summary-prompts')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCreateSummaryPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; description?: string; systemPrompt: string; userPrompt: string; isDefault?: boolean; sortOrder?: number }) => {
      const { data, error, response } = await getApiClient().POST('/api/summary-prompts', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summary-prompts'] }),
  })
}

export function useUpdateSummaryPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ promptId, ...body }: { promptId: string; name?: string; description?: string; systemPrompt?: string; userPrompt?: string; isDefault?: boolean; sortOrder?: number }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/summary-prompts/{promptId}', {
        params: { path: { promptId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summary-prompts'] }),
  })
}

export function useDeleteSummaryPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (promptId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/summary-prompts/{promptId}', {
        params: { path: { promptId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summary-prompts'] }),
  })
}
