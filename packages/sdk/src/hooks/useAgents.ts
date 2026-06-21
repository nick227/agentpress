import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '../generated/types'
import { ApiError, getApiClient } from '../client'

type Agent = components['schemas']['Agent']
type AgentInput = components['schemas']['AgentInput']
type AgentKind = Agent['kind']

export function useAgents(filters?: { kind?: AgentKind; category?: string; search?: string; resolved?: boolean }) {
  return useQuery({
    queryKey: ['agents', filters?.kind, filters?.category, filters?.search, filters?.resolved],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/agents', { params: { query: filters } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agents', agentId],
    enabled: Boolean(agentId),
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/agents/{agentId}', { params: { path: { agentId } } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
  })
}

export function useCreateAgent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: AgentInput) => {
      const { data, error, response } = await getApiClient().POST('/api/agents', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUpdateAgent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentId, ...body }: { agentId: string } & Partial<AgentInput>) => {
      const { data, error, response } = await getApiClient().PATCH('/api/agents/{agentId}', {
        params: { path: { agentId } }, body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useDeleteAgent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/agents/{agentId}', { params: { path: { agentId } } })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['agents'] }),
  })
}
