export type CadenceType = 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface RecurrenceConfig {
  cadenceType: CadenceType | string
  timezone: string
  minuteOfHour?: number | null
  timeOfDay?: string | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw Object.assign(new Error(`Invalid timezone: ${timezone}`), { statusCode: 400 })
  }
}

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  }
}

function parseTime(value?: string | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

function fakeUtc(parts: Pick<LocalParts, 'year' | 'month' | 'day' | 'hour' | 'minute'>) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute))
}

function fakeParts(date: Date): Omit<LocalParts, 'weekday'> {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  }
}

function zonedTimeToUtc(desired: Omit<LocalParts, 'weekday'>, timezone: string): Date | null {
  const desiredMs = fakeUtc(desired).getTime()
  let candidate = new Date(desiredMs)
  for (let iteration = 0; iteration < 4; iteration++) {
    const actual = localParts(candidate, timezone)
    const actualMs = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    candidate = new Date(candidate.getTime() + desiredMs - actualMs)
  }
  const resolved = localParts(candidate, timezone)
  return resolved.year === desired.year
    && resolved.month === desired.month
    && resolved.day === desired.day
    && resolved.hour === desired.hour
    && resolved.minute === desired.minute
    ? candidate
    : null
}

export function nextScheduleOccurrence(config: RecurrenceConfig, after = new Date()): Date | null {
  if (config.cadenceType === 'manual') return null
  validateTimezone(config.timezone)

  const time = parseTime(config.timeOfDay)
  const minuteOfHour = config.minuteOfHour ?? 0
  const localAfter = localParts(after, config.timezone)
  const base = fakeUtc(localAfter)

  for (let attempt = 0; attempt < 370; attempt++) {
    let desiredDate: Date
    if (config.cadenceType === 'hourly') {
      desiredDate = new Date(base)
      desiredDate.setUTCMinutes(minuteOfHour, 0, 0)
      if (desiredDate.getTime() <= fakeUtc(localAfter).getTime()) desiredDate.setUTCHours(desiredDate.getUTCHours() + 1)
    } else {
      if (!time) throw Object.assign(new Error('A local time is required for this cadence'), { statusCode: 400 })
      desiredDate = new Date(base)
      desiredDate.setUTCHours(time.hour, time.minute, 0, 0)
      if (config.cadenceType === 'daily') {
        if (desiredDate.getTime() <= fakeUtc(localAfter).getTime()) desiredDate.setUTCDate(desiredDate.getUTCDate() + 1)
      } else if (config.cadenceType === 'weekly') {
        let delta = (Number(config.dayOfWeek) - localAfter.weekday + 7) % 7
        if (delta === 0 && desiredDate.getTime() <= fakeUtc(localAfter).getTime()) delta = 7
        desiredDate.setUTCDate(desiredDate.getUTCDate() + delta)
      } else {
        desiredDate.setUTCDate(Number(config.dayOfMonth))
        if (desiredDate.getTime() <= fakeUtc(localAfter).getTime()) desiredDate.setUTCMonth(desiredDate.getUTCMonth() + 1)
      }
    }

    if (attempt > 0) {
      if (config.cadenceType === 'hourly') desiredDate.setUTCHours(desiredDate.getUTCHours() + attempt)
      if (config.cadenceType === 'daily') desiredDate.setUTCDate(desiredDate.getUTCDate() + attempt)
      if (config.cadenceType === 'weekly') desiredDate.setUTCDate(desiredDate.getUTCDate() + attempt * 7)
      if (config.cadenceType === 'monthly') desiredDate.setUTCMonth(desiredDate.getUTCMonth() + attempt)
    }
    const candidate = zonedTimeToUtc(fakeParts(desiredDate), config.timezone)
    if (candidate && candidate.getTime() > after.getTime()) return candidate
  }

  throw Object.assign(new Error('Could not calculate the next schedule occurrence'), { statusCode: 400 })
}
