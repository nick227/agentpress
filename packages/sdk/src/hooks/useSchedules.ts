import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, getApiClient } from '../client'
import type { components } from '../generated/types'

export type ScheduleInput = components['schemas']['ScheduleInput']

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/api/schedules')
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
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
    mutationFn: async (body: ScheduleInput) => {
      const { data, error, response } = await getApiClient().POST('/api/schedules', { body })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, ...body }: ScheduleInput & { scheduleId: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/api/schedules/{scheduleId}', {
        params: { path: { scheduleId } },
        body,
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (data, { scheduleId }) => {
      queryClient.setQueryData(['schedule', scheduleId], data)
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/api/schedules/{scheduleId}', {
        params: { path: { scheduleId } },
      })
      if (error) throw new ApiError((response as Response).status, (error as any).error)
      return data!
    },
    onSuccess: (_data, scheduleId) => {
      queryClient.removeQueries({ queryKey: ['schedule', scheduleId] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
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
      queryClient.invalidateQueries({ queryKey: ['account-navigation'] })
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
