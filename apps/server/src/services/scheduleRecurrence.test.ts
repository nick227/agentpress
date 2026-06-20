import { describe, expect, it } from 'vitest'
import { nextScheduleOccurrence } from './scheduleRecurrence'

describe('nextScheduleOccurrence', () => {
  it('calculates an hourly occurrence in UTC', () => {
    expect(nextScheduleOccurrence(
      { cadenceType: 'hourly', timezone: 'UTC', minuteOfHour: 15 },
      new Date('2026-06-19T10:16:00.000Z'),
    )?.toISOString()).toBe('2026-06-19T11:15:00.000Z')
  })

  it('uses local calendar time in another timezone', () => {
    expect(nextScheduleOccurrence(
      { cadenceType: 'daily', timezone: 'America/Chicago', timeOfDay: '09:00' },
      new Date('2026-06-19T13:30:00.000Z'),
    )?.toISOString()).toBe('2026-06-19T14:00:00.000Z')
  })

  it('supports weekly and monthly calendar constraints', () => {
    expect(nextScheduleOccurrence(
      { cadenceType: 'weekly', timezone: 'UTC', timeOfDay: '08:00', dayOfWeek: 1 },
      new Date('2026-06-19T00:00:00.000Z'),
    )?.toISOString()).toBe('2026-06-22T08:00:00.000Z')
    expect(nextScheduleOccurrence(
      { cadenceType: 'monthly', timezone: 'UTC', timeOfDay: '08:00', dayOfMonth: 3 },
      new Date('2026-06-19T00:00:00.000Z'),
    )?.toISOString()).toBe('2026-07-03T08:00:00.000Z')
  })

  it('returns no occurrence for manual schedules', () => {
    expect(nextScheduleOccurrence({ cadenceType: 'manual', timezone: 'UTC' })).toBeNull()
  })

  it('skips a nonexistent wall-clock time during spring DST', () => {
    expect(nextScheduleOccurrence(
      { cadenceType: 'daily', timezone: 'America/Chicago', timeOfDay: '02:30' },
      new Date('2026-03-08T06:00:00.000Z'),
    )?.toISOString()).toBe('2026-03-09T07:30:00.000Z')
  })

  it('does not run twice in the repeated fall DST hour', () => {
    expect(nextScheduleOccurrence(
      { cadenceType: 'daily', timezone: 'America/Chicago', timeOfDay: '01:30' },
      new Date('2026-11-01T06:30:00.000Z'),
    )?.toISOString()).toBe('2026-11-02T07:30:00.000Z')
  })
})
