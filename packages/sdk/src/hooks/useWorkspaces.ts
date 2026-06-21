import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient } from '../client'

export type Workspace = {
  id: string
  name: string
  slug: string
  type: 'PERSONAL' | 'TEAM' | 'COMMUNITY'
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/workspaces')
      if (error) throw error
      return ((data as any)?.data ?? []) as Workspace[]
    },
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await getApiClient().POST('/api/workspaces', { body: { name } })
      if (error) throw error
      return (data as any)?.data as Workspace
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data, error } = await getApiClient().GET('/api/workspaces/{workspaceId}/members', {
        params: { path: { workspaceId: workspaceId! } },
      })
      if (error) throw error
      return ((data as any)?.data ?? []) as Array<{ userId: string; role: Workspace['role']; user: { id: string; email: string } }>
    },
  })
}

export function useAddWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; role: 'ADMIN' | 'EDITOR' | 'VIEWER' }) => {
      const { data, error } = await getApiClient().POST('/api/workspaces/{workspaceId}/members', {
        params: { path: { workspaceId } }, body: input,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}

export function useUpdateWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { userId: string; role: 'ADMIN' | 'EDITOR' | 'VIEWER' }) => {
      const { data, error } = await getApiClient().PATCH('/api/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId, userId: input.userId } }, body: { role: input.role },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await getApiClient().DELETE('/api/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId, userId } },
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}
