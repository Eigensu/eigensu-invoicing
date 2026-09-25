import { format } from 'date-fns'

// House date format used across the app and the invoice PDF (e.g. "15 Jun 2026").
export function formatDate(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'dd MMM yyyy')
}
