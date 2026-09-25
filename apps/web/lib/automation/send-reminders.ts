import { db } from '@eigensu/db'
import {
  invoices,
  reminders,
  reminderRules,
  settings,
} from '@eigensu/db/schema'
import { and, eq, inArray, or, gte, sql } from 'drizzle-orm'
import { dueReminders, formatINR, addAmounts, computeInvoiceOutstanding } from '@eigensu/core'
import { writeAuditLog } from '@/lib/audit'
import { dateToISO } from './today-ist'

const PER_RUN_CAP = 50

export interface ReminderSummary {
  sent: number
  skipped: number
  failed: number
  alertsSent: number
}

export async function sendDueReminders(todayIST: Date): Promise<ReminderSummary> {
  const summary: ReminderSummary = { sent: 0, skipped: 0, failed: 0, alertsSent: 0 }

  const [settingsRow] = await db.select().from(settings).limit(1)
  if (!settingsRow) return summary

  // Load all enabled rules
  const rules = await db.query.reminderRules.findMany({
    where: eq(reminderRules.enabled, true),
  })

  // Open invoices
  const openInvoices = await db.query.invoices.findMany({
    where: inArray(invoices.status, ['sent', 'partial', 'overdue']),
    with: { client: true, payments: true, bankAccount: true },
    limit: PER_RUN_CAP,
  })

  const { sendReminderEmail, sendAlertEmail } = await import('@eigensu/email')

  for (const invoice of openInvoices) {
    // Find already-handled ruleIds (sent, or failed ≥3 retries)
    const handledReminders = await db.query.reminders.findMany({
      where: and(
        eq(reminders.invoiceId, invoice.id),
        or(
          eq(reminders.status, 'sent'),
          and(eq(reminders.status, 'failed'), gte(reminders.retryCount, 3)),
        ),
      ),
    })
    const alreadySentRuleIds = new Set(handledReminders.map((r) => r.ruleId))

    const outstanding = computeInvoiceOutstanding(
      Number(invoice.total),
      invoice.payments.map((p) => ({ amount: Number(p.amount) })),
    )

    const firings = dueReminders(
      {
        id: invoice.id,
        dueDate: new Date(invoice.dueDate),
        status: invoice.status,
      },
      rules.map((r) => ({
        id: r.id,
        type: r.type,
        offsetDays: r.offsetDays,
        enabled: r.enabled,
        ccFounders: r.ccFounders,
      })),
      todayIST,
      alreadySentRuleIds,
    )

    for (const firing of firings) {
      // Check for existing reminder row (retry case)
      const existingReminder = await db.query.reminders.findFirst({
        where: and(
          eq(reminders.invoiceId, invoice.id),
          eq(reminders.ruleId, firing.rule.id),
        ),
      })

      let reminderId: string

      if (existingReminder) {
        reminderId = existingReminder.id
        // Update back to pending for retry
        await db
          .update(reminders)
          .set({ status: 'pending' })
          .where(eq(reminders.id, reminderId))
      } else {
        const [inserted] = await db
          .insert(reminders)
          .values({
            ruleId: firing.rule.id,
            type: firing.rule.type,
            invoiceId: invoice.id,
            scheduledFor: dateToISO(firing.scheduledFor),
            status: 'pending',
            recipients: [invoice.client.email],
            retryCount: 0,
          })
          .returning()
        if (!inserted) continue
        reminderId = inserted.id
      }

      const daysUntilDue = Math.ceil(
        (new Date(invoice.dueDate).getTime() - todayIST.getTime()) / (1000 * 60 * 60 * 24),
      )
      const daysOverdue = Math.max(0, -daysUntilDue)

      const templateVars: Record<string, string> = {
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: formatINR(Number(invoice.total)),
        outstanding: formatINR(outstanding),
        dueDate: invoice.dueDate,
        daysUntilDue: String(Math.max(0, daysUntilDue)),
        daysOverdue: String(daysOverdue),
        companyName: settingsRow.companyName,
        companyEmail: settingsRow.email,
        companyPhone: settingsRow.phone,
      }

      const rule = rules.find((r) => r.id === firing.rule.id)!

      try {
        if (firing.rule.type === 'internal_alert') {
          // Build overdue summary for founders
          const overdueInvoices = await db.query.invoices.findMany({
            where: inArray(invoices.status, ['overdue']),
            with: { client: true, payments: true },
          })
          const alertVars = {
            overdueCount: String(overdueInvoices.length),
            totalOutstanding: formatINR(
              overdueInvoices.reduce(
                (sum, inv) =>
                  addAmounts(
                    sum,
                    computeInvoiceOutstanding(
                      Number(inv.total),
                      inv.payments.map((p) => ({ amount: Number(p.amount) })),
                    ),
                  ),
                0,
              ),
            ),
            invoiceRows: overdueInvoices
              .map(
                (inv) =>
                  `${inv.invoiceNumber} | ${inv.client.name} | ${formatINR(Number(inv.total))} | Due: ${inv.dueDate}`,
              )
              .join('\n'),
          }

          await sendAlertEmail({
            to: settingsRow.founderEmails,
            subject: interpolate(rule.subject, alertVars),
            htmlBody: interpolate(rule.bodyTemplate, alertVars),
          })

          await db
            .update(reminders)
            .set({ status: 'sent', sentAt: new Date() })
            .where(eq(reminders.id, reminderId))

          summary.alertsSent++
        } else {
          const cc = rule.ccFounders ? settingsRow.founderEmails : []

          await sendReminderEmail({
            to: invoice.client.email,
            subject: interpolate(rule.subject, templateVars),
            htmlBody: interpolate(rule.bodyTemplate, templateVars),
            cc,
          })

          await db
            .update(reminders)
            .set({ status: 'sent', sentAt: new Date() })
            .where(eq(reminders.id, reminderId))

          summary.sent++
        }
      } catch (err) {
        await db
          .update(reminders)
          .set({
            status: 'failed',
            error: String(err),
            retryCount: sql`${reminders.retryCount} + 1`,
          })
          .where(eq(reminders.id, reminderId))

        summary.failed++
        await writeAuditLog(null, 'REMINDER_SEND_FAILED', 'reminder', reminderId, {
          error: String(err),
          invoiceId: invoice.id,
          ruleId: firing.rule.id,
        })
      }
    }
  }

  return summary
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
