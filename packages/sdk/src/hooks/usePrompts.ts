import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

type PromptKind = 'TRANSFORMATIONAL' | 'CONTENT'

export function usePrompts(filters?: { kind?: PromptKind; category?: string; search?: string; resolved?: boolean }) {
  return useQuery({
    queryKey: ['prompts', filters?.kind, filters?.category, filters?.search, filters?.resolved],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/prompts', {
        params: { query: filters },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function usePrompt(promptId: string) {
  return useQuery({
    queryKey: ['prompts', promptId],
    enabled: Boolean(promptId),
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/prompts/{promptId}', {
        params: { path: { promptId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCreatePrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name: string
      key?: string
      description?: string
      kind?: PromptKind
      category?: string
      tags?: string[]
      systemPrompt: string
      userPrompt: string
      uid?: string
      outputTarget?: string
      outputFormat?: string
      sortOrder?: number
      isDefault?: boolean
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/prompts', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['summary-prompts'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      promptId,
      ...body
    }: {
      promptId: string
      name?: string
      key?: string
      description?: string
      kind?: PromptKind
      category?: string
      tags?: string[]
      systemPrompt?: string
      userPrompt?: string
      uid?: string
      outputTarget?: string
      outputFormat?: string
      sortOrder?: number
      isDefault?: boolean
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/prompts/{promptId}', {
        params: { path: { promptId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['summary-prompts'] })
      queryClient.invalidateQueries({ queryKey: ['prompts', variables.promptId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeletePrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (promptId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/prompts/{promptId}', {
        params: { path: { promptId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['summary-prompts'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}
