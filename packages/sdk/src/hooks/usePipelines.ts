import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type PipelineVariableInput = components['schemas']['PipelineVariableInput']
type PipelineAgentInput = components['schemas']['PipelineAgentInput']

export function usePipelines(accountId: string) {
  return useQuery({
    queryKey: ['pipelines', accountId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/{accountId}/pipelines', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(accountId),
  })
}

export function usePipeline(pipelineId: string) {
  return useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/pipelines/{pipelineId}', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(pipelineId),
  })
}

export function useCreatePipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, ...body }: { accountId: string; name: string; description?: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts/{accountId}/pipelines', {
        params: { path: { accountId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pipelineId,
      ...body
    }: {
      pipelineId: string
      name?: string
      description?: string
      status?: 'draft' | 'active' | 'paused' | 'archived'
      destinationId?: string | null
      wpCategoryIds?: number[] | null
      bodyComposer?: Array<Record<string, unknown>>
      dryRun?: boolean
      variables?: PipelineVariableInput[]
      agents?: PipelineAgentInput[]
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/pipelines/{pipelineId}', {
        params: { path: { pipelineId } },
        body: body as Record<string, unknown>,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data, { pipelineId }) => {
      queryClient.setQueryData(['pipeline', pipelineId], (current: unknown) => {
        if (!current || typeof current !== 'object') return current
        return { ...current, data: data.data }
      })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeletePipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pipelineId, accountId }: { pipelineId: string; accountId: string }) => {
      const { data, error, response } = await getApiClient().DELETE('/api/pipelines/{pipelineId}', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useValidatePipeline() {
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/validate', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function usePromptAssist() {
  return useMutation({
    mutationFn: async (body: {
      pipelineName: string
      variables?: components['schemas']['PipelineVariable'][]
      previousAgents?: components['schemas']['PipelineAgent'][]
      currentAgent?: components['schemas']['PipelineAgent']
      promptKind: 'system' | 'user'
      currentPrompt?: string
      userInstruction: string
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/prompt-assist', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}
