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
      username?: string
      secret: string
      defaultStatus?: 'draft' | 'publish'
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
    },
  })
}
