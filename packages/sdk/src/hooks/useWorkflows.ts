import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '../generated/types'
import { ApiError, getApiClient } from '../client'

type Workflow = components['schemas']['Workflow']
type WorkflowSummary = components['schemas']['WorkflowSummary']
type WorkflowInput = components['schemas']['WorkflowInput']

export function useWorkflows(filters?: { category?: string; search?: string; resolved?: boolean }) {
  return useQuery({
    queryKey: ['workflows', filters?.category, filters?.search, filters?.resolved],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/workflows', { params: { query: filters } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ['workflows', workflowId],
    enabled: Boolean(workflowId),
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/workflows/{workflowId}', { params: { path: { workflowId } } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCreateWorkflow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: WorkflowInput) => {
      const { data, error, response } = await getApiClient().POST('/api/workflows', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useUpdateWorkflow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ workflowId, ...body }: { workflowId: string } & Partial<WorkflowInput>) => {
      const { data, error, response } = await getApiClient().PATCH('/api/workflows/{workflowId}', {
        params: { path: { workflowId } }, body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { workflowId }) => {
      client.invalidateQueries({ queryKey: ['workflows'] })
      client.invalidateQueries({ queryKey: ['workflows', workflowId] })
    },
  })
}

export function useDeleteWorkflow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (workflowId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/workflows/{workflowId}', { params: { path: { workflowId } } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useCommunityWorkflows() {
  return useQuery({
    queryKey: ['community', 'workflows'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/community/workflows')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCommunityWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ['community', 'workflows', workflowId],
    enabled: Boolean(workflowId),
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/community/workflows/{workflowId}', { params: { path: { workflowId } } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useForkCommunityWorkflow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ workflowId, name }: { workflowId: string; name?: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/community/workflows/{workflowId}/fork', {
        params: { path: { workflowId } },
        body: name ? { name } : {},
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workflows'] })
      client.invalidateQueries({ queryKey: ['community', 'workflows'] })
    },
  })
}

export function useInsertWorkflowIntoPipeline() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pipelineId,
      workflowId,
      insertAfterSortOrder,
    }: { pipelineId: string; workflowId: string; insertAfterSortOrder?: number }) => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/workflows/insert', {
        params: { path: { pipelineId } },
        body: { workflowId, insertAfterSortOrder },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { pipelineId }) => {
      client.invalidateQueries({ queryKey: ['pipelines', pipelineId] })
      client.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}
