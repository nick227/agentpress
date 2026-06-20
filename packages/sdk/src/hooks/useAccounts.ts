import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useAccountNavigation() {
  return useQuery({
    queryKey: ['account-navigation'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/navigation')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useAccount(accountId: string) {
  return useQuery({
    queryKey: ['accounts', accountId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/{accountId}', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(accountId),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; category?: string; phone?: string; email?: string; description?: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, ...body }: { accountId: string; name?: string; category?: string; phone?: string; email?: string; description?: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/accounts/{accountId}', {
        params: { path: { accountId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/accounts/{accountId}', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useSyncAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts/{accountId}/sync', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, accountId) => {
      queryClient.invalidateQueries({ queryKey: ['research-sources', accountId] })
      queryClient.invalidateQueries({ queryKey: ['pipelines', accountId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] })
    },
  })
}
