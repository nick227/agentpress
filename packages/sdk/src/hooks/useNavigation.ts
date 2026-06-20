import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useAccountNavigation() {
  return useQuery({
    queryKey: ['account-navigation'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/navigation')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

export function useSyncAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await getApiClient().POST('/api/sync')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-sources'] })
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}
