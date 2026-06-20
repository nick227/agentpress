import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useDestinations(accountId: string) {
  return useQuery({
    queryKey: ['destinations', accountId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/{accountId}/destinations', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(accountId),
  })
}

export function useWordPressCategories(destinationId?: string) {
  return useQuery({
    queryKey: ['wordpress-categories', destinationId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/destinations/{destinationId}/wordpress/categories', {
        params: { path: { destinationId: destinationId! } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(destinationId),
  })
}

export function useCreateDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      accountId,
      ...body
    }: {
      accountId: string
      name: string
      siteUrl: string
      username: string
      secret: string
      defaultStatus?: 'draft' | 'publish'
      defaultCategoryIds?: number[]
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts/{accountId}/destinations', {
        params: { path: { accountId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdateDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      destinationId,
      accountId,
      ...body
    }: {
      destinationId: string
      accountId: string
      name?: string
      defaultStatus?: 'draft' | 'publish'
      defaultCategoryIds?: number[] | null
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/destinations/{destinationId}', {
        params: { path: { destinationId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId, destinationId }) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', accountId] })
      queryClient.invalidateQueries({ queryKey: ['wordpress-categories', destinationId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeleteDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ destinationId, accountId }: { destinationId: string; accountId: string }) => {
      const { data, error, response } = await getApiClient().DELETE('/api/destinations/{destinationId}', {
        params: { path: { destinationId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}
