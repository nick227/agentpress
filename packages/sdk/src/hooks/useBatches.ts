import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { components } from '../generated/types'
import { getApiClient, ApiError } from '../client'

type PipelineLoop = components['schemas']['PipelineLoop']
type BatchPreview = components['schemas']['BatchPreview']
type PipelineRunBatch = components['schemas']['PipelineRunBatch']

export function usePipelineLoop(pipelineId: string) {
  return useQuery({
    queryKey: ['pipeline-loop', pipelineId],
    queryFn: async (): Promise<{ data: PipelineLoop | null }> => {
      const { data, error, response } = await getApiClient().GET('/api/pipelines/{pipelineId}/loop', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: PipelineLoop | null }
    },
    enabled: Boolean(pipelineId),
  })
}

export function useUpsertPipelineLoop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pipelineId, ...body }: {
      pipelineId: string
      loopType: 'research_feed' | 'dataset'
      sourceId?: string
      cursorMode: 'all_stored' | 'new_since_cursor' | 'date_range'
      cursorAt?: string
      dateRangeStart?: string
      dateRangeEnd?: string
      variableMap?: Record<string, string>
      dataset?: {
        sourceType: 'csv' | 'google_sheets'
        name?: string
        csvText?: string
        url?: string
      }
      maxBatchSize?: number
    }): Promise<{ data: PipelineLoop }> => {
      const { data, error, response } = await getApiClient().PUT('/api/pipelines/{pipelineId}/loop', {
        params: { path: { pipelineId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: PipelineLoop }
    },
    onSuccess: (_data, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-loop', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
    },
  })
}

export function useDeletePipelineLoop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const { error, response } = await getApiClient().DELETE('/api/pipelines/{pipelineId}/loop', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
    },
    onSuccess: (_data, pipelineId) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-loop', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
    },
  })
}

export function usePreviewBatch() {
  return useMutation({
    mutationFn: async ({ pipelineId, ...body }: {
      pipelineId: string
      cursorMode?: 'all_stored' | 'new_since_cursor' | 'date_range'
      dateRangeStart?: string
      dateRangeEnd?: string
    }): Promise<{ data: BatchPreview }> => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/batch/preview', {
        params: { path: { pipelineId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: BatchPreview }
    },
  })
}

export function useStartBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pipelineId, ...body }: {
      pipelineId: string
      dryRun?: boolean
      cursorMode?: 'all_stored' | 'new_since_cursor' | 'date_range'
      dateRangeStart?: string
      dateRangeEnd?: string
    }): Promise<{ data: PipelineRunBatch }> => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/batch', {
        params: { path: { pipelineId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: PipelineRunBatch }
    },
    onSuccess: (_data, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-batches', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['all-runs'] })
    },
  })
}

export function usePipelineBatches(pipelineId: string) {
  return useQuery({
    queryKey: ['pipeline-batches', pipelineId],
    queryFn: async (): Promise<{ data: PipelineRunBatch[] }> => {
      const { data, error, response } = await getApiClient().GET('/api/pipelines/{pipelineId}/batches', {
        params: { path: { pipelineId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: PipelineRunBatch[] }
    },
    enabled: Boolean(pipelineId),
    refetchInterval: (query) => {
      const batches = (query.state.data as { data: PipelineRunBatch[] } | undefined)?.data ?? []
      const hasActive = batches.some((b) => b.status === 'queued' || b.status === 'running')
      return hasActive ? 3000 : false
    },
    refetchIntervalInBackground: false,
  })
}

export function usePipelineBatch(batchId: string) {
  return useQuery({
    queryKey: ['pipeline-batch', batchId],
    queryFn: async (): Promise<{ data: PipelineRunBatch }> => {
      const { data, error, response } = await getApiClient().GET('/api/pipeline-batches/{batchId}', {
        params: { path: { batchId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data as { data: PipelineRunBatch }
    },
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const status = (query.state.data as { data: PipelineRunBatch } | undefined)?.data?.status
      return status === 'queued' || status === 'running' ? 3000 : false
    },
    refetchIntervalInBackground: false,
  })
}
