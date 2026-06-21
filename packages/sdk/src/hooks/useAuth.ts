import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/auth/me')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error, response } = await getApiClient().POST('/auth/login', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error, response } = await getApiClient().POST('/auth/register', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await getApiClient().POST('/auth/logout')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/auth/me', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
