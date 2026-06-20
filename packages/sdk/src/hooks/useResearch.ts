import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useResearchSources(accountId: string) {
  return useQuery({
    queryKey: ['research-sources', accountId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/{accountId}/research', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(accountId),
  })
}

export function useResearchSource(idOrSlug: string) {
  return useQuery({
    queryKey: ['research-source', idOrSlug],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/research/{sourceId}', {
        params: { path: { sourceId: idOrSlug } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(idOrSlug),
  })
}

export function useCreateResearchSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, ...body }: { accountId: string; name: string; sourceType?: 'youtube' | 'reddit' | 'rss'; category?: string; sourceUrl: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts/{accountId}/research', {
        params: { path: { accountId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['research-sources', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdateResearchSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId, ...body }: {
      sourceId: string
      name?: string
      category?: string
      sourceUrl?: string
      status?: 'active' | 'paused'
      defaultSummaryPromptId?: string | null
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/research/{sourceId}', {
        params: { path: { sourceId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['research-source'] })
      queryClient.invalidateQueries({ queryKey: ['research-sources', data.data.accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeleteResearchSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/research/{sourceId}', {
        params: { path: { sourceId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-sources'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useCheckResearchSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/research/{sourceId}/check', {
        params: { path: { sourceId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, sourceId) => {
      queryClient.invalidateQueries({ queryKey: ['research-source'] })
      queryClient.invalidateQueries({ queryKey: ['research-items', sourceId] })
      queryClient.invalidateQueries({ queryKey: ['research-items'] })
    },
  })
}

export function useResearchItems(sourceId: string, page = 1, limit = 15) {
  return useQuery({
    queryKey: ['research-items', sourceId, page, limit],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/research/{sourceId}/items', {
        params: { path: { sourceId }, query: { page, limit } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(sourceId),
  })
}

export function useResearchItem(itemId: string) {
  return useQuery({
    queryKey: ['research-item', itemId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/research/items/{itemId}', {
        params: { path: { itemId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(itemId),
  })
}

export function useResearchSummaries(itemId: string) {
  return useQuery({
    queryKey: ['research-summaries', itemId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/research/items/{itemId}/summaries', {
        params: { path: { itemId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(itemId),
  })
}

export function useSummarizeResearchItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, promptId }: { itemId: string; promptId: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/research/items/{itemId}/summarize', {
        params: { path: { itemId } },
        body: { promptId },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['research-summaries', data.data.itemId] })
      queryClient.invalidateQueries({ queryKey: ['research-item', data.data.itemId] })
    },
  })
}

export function useRefreshResearchItemContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/research/items/{itemId}/refresh-content', {
        params: { path: { itemId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['research-item', data.data.id] })
      queryClient.invalidateQueries({ queryKey: ['research-items'] })
    },
  })
}
