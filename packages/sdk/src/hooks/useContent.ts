import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useContentTemplates() {
  return useQuery({
    queryKey: ['content-templates'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/content/templates')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useVariablePacks() {
  return useQuery({
    queryKey: ['variable-packs'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/content/variable-packs')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useApplyContentTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      templateId,
      name,
    }: {
      templateId: string
      name?: string
    }) => {
      const { data, error, response } = await getApiClient().POST(
        '/api/content/templates/{templateId}/apply',
        { params: { path: { templateId } }, body: { name } },
      )
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
  })
}
