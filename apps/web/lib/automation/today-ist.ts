import { toZonedTime } from 'date-fns-tz'
import { startOfDay } from 'date-fns'

export function getTodayIST(): Date {
  const tz = process.env['APP_TIMEZONE'] ?? 'Asia/Kolkata'
  return startOfDay(toZonedTime(new Date(), tz))
}

export function dateToISO(d: Date): string {
  return d.toISOString().split('T')[0]!
}
