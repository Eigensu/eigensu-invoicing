import { getTodayIST, dateToISO } from './today-ist'
import { generateRecurringInvoices } from './generate-recurring'
import { markOverdue } from './mark-overdue'
import { sendDueReminders } from './send-reminders'
import { writeAuditLog } from '@/lib/audit'

export interface CronSummary {
  generatedInvoices: number
  overdueFlagged: number
  remindersSent: number
  remindersSkipped: number
  remindersFailed: number
  alertsSent: number
  todayIST: string
  errors: string[]
}

export async function runDailyCron(): Promise<CronSummary> {
  const todayIST = getTodayIST()
  const summary: CronSummary = {
    generatedInvoices: 0,
    overdueFlagged: 0,
    remindersSent: 0,
    remindersSkipped: 0,
    remindersFailed: 0,
    alertsSent: 0,
    todayIST: dateToISO(todayIST),
    errors: [],
  }

  // Step 1: Generate recurring invoices
  try {
    summary.generatedInvoices = await generateRecurringInvoices(todayIST)
  } catch (err) {
    summary.errors.push(`Step 1 (generate): ${String(err)}`)
  }

  // Step 2: Mark overdue
  try {
    summary.overdueFlagged = await markOverdue(todayIST)
  } catch (err) {
    summary.errors.push(`Step 2 (overdue): ${String(err)}`)
  }

  // Steps 3+4: Send reminders and alerts
  try {
    const reminderResult = await sendDueReminders(todayIST)
    summary.remindersSent = reminderResult.sent
    summary.remindersFailed = reminderResult.failed
    summary.remindersSkipped = reminderResult.skipped
    summary.alertsSent = reminderResult.alertsSent
  } catch (err) {
    summary.errors.push(`Step 3 (reminders): ${String(err)}`)
  }

  // Step 5: Audit log
  await writeAuditLog(null, 'CRON_RUN', undefined, undefined, {
    ...summary,
    timestamp: new Date().toISOString(),
  })

  return summary
}
