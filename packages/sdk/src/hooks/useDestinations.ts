import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useDestinations() {
  return useQuery({
    queryKey: ['destinations'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/destinations')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useDestination(destinationId: string) {
  return useQuery({
    queryKey: ['destination', destinationId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/destinations/{destinationId}', {
        params: { path: { destinationId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(destinationId),
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
    mutationFn: async (body: {
      name: string
      siteUrl: string
      username: string
      secret: string
      defaultStatus?: 'draft' | 'publish'
      defaultCategoryIds?: number[]
    }) => {
      const { data, error, response } = await getApiClient().POST('/api/destinations', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdateDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      destinationId,
      ...body
    }: {
      destinationId: string
      name?: string
      siteUrl?: string
      username?: string
      secret?: string
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
    onSuccess: (_data, { destinationId }) => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
      queryClient.invalidateQueries({ queryKey: ['destination', destinationId] })
      queryClient.invalidateQueries({ queryKey: ['wordpress-categories', destinationId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeleteDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (destinationId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/destinations/{destinationId}', {
        params: { path: { destinationId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}
