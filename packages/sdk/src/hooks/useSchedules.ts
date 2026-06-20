import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, getApiClient } from '../client'
import type { components } from '../generated/types'

export type ScheduleInput = components['schemas']['ScheduleInput']

export function useSchedules(accountId: string) {
  return useQuery({
    queryKey: ['schedules', accountId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/accounts/{accountId}/schedules', {
        params: { path: { accountId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(accountId),
  })
}

export function useSchedule(scheduleId: string) {
  return useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/schedules/{scheduleId}', {
        params: { path: { scheduleId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(scheduleId),
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, ...body }: ScheduleInput & { accountId: string }) => {
      const { data, error, response } = await getApiClient().POST('/api/accounts/{accountId}/schedules', {
        params: { path: { accountId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, { accountId }) => queryClient.invalidateQueries({ queryKey: ['schedules', accountId] }),
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, accountId: _accountId, ...body }: ScheduleInput & { scheduleId: string; accountId: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/schedules/{scheduleId}', {
        params: { path: { scheduleId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data, { scheduleId, accountId }) => {
      queryClient.setQueryData(['schedule', scheduleId], data)
      queryClient.invalidateQueries({ queryKey: ['schedules', accountId] })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, accountId }: { scheduleId: string; accountId: string }) => {
      const { data, error, response } = await getApiClient().DELETE('/api/schedules/{scheduleId}', {
        params: { path: { scheduleId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return { data: data!, accountId }
    },
    onSuccess: ({ accountId }, { scheduleId }) => {
      queryClient.removeQueries({ queryKey: ['schedule', scheduleId] })
      queryClient.invalidateQueries({ queryKey: ['schedules', accountId] })
    },
  })
}

export function useRunSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error, response } = await getApiClient().POST('/api/schedules/{scheduleId}/run', {
        params: { path: { scheduleId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-executions', scheduleId] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

export function useScheduleExecutions(scheduleId: string) {
  return useQuery({
    queryKey: ['schedule-executions', scheduleId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/schedules/{scheduleId}/executions', {
        params: { path: { scheduleId }, query: { limit: 25 } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(scheduleId),
    refetchInterval: (query) => query.state.data?.data.some((item) => ['queued', 'running'].includes(item.status)) ? 1500 : false,
  })
}

export function useScheduleExecution(executionId: string) {
  return useQuery({
    queryKey: ['schedule-execution', executionId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/schedule-executions/{executionId}', {
        params: { path: { executionId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    enabled: Boolean(executionId),
    refetchInterval: (query) => ['queued', 'running'].includes(query.state.data?.data.status ?? '') ? 1500 : false,
  })
}
