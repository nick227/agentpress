import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useImageAssets(pipelineId: string, agentId?: string) {
  return useQuery({
    queryKey: ['image-assets', pipelineId, agentId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/pipelines/{pipelineId}/image-assets', {
        params: { path: { pipelineId }, query: { agentId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(pipelineId),
  })
}

export function useGenerateImageAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pipelineId, agentId, prompt }: { pipelineId: string; agentId: string; prompt: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/image-assets/generate', {
        params: { path: { pipelineId } },
        body: { agentId, prompt },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { pipelineId, agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['image-assets', pipelineId, agentId] })
    },
  })
}

export function useUploadImageAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      pipelineId: string
      agentId: string
      dataBase64: string
      filename?: string
      label?: string
    }) => {
      const { pipelineId, ...body } = input
      const { data, error, response } = await getApiClient().POST('/api/pipelines/{pipelineId}/image-assets/upload', {
        params: { path: { pipelineId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { pipelineId, agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['image-assets', pipelineId, agentId] })
    },
  })
}

