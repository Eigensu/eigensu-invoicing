export type ReminderType =
  | 'client_due_soon'
  | 'client_due'
  | 'client_overdue'
  | 'internal_alert'

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled'

export interface ReminderRule {
  id: string
  type: ReminderType
  offsetDays: number
  enabled: boolean
  ccFounders: boolean
}

export interface InvoiceSummary {
  id: string
  dueDate: Date
  status: InvoiceStatus
}

export interface ReminderFiring {
  rule: ReminderRule
  scheduledFor: Date
}

export function dueReminders(
  invoice: InvoiceSummary,
  rules: ReminderRule[],
  todayIST: Date,
  alreadySentRuleIds: Set<string>,
): ReminderFiring[] {
  const firings: ReminderFiring[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (alreadySentRuleIds.has(rule.id)) continue

    // fireDate = dueDate + offsetDays (negative = before due)
    const fireDate = new Date(invoice.dueDate)
    fireDate.setDate(fireDate.getDate() + rule.offsetDays)

    // Strip time — compare dates only
    const fireDateMidnight = new Date(
      fireDate.getFullYear(),
      fireDate.getMonth(),
      fireDate.getDate(),
    )
    const todayMidnight = new Date(
      todayIST.getFullYear(),
      todayIST.getMonth(),
      todayIST.getDate(),
    )

    if (fireDateMidnight <= todayMidnight) {
      firings.push({ rule, scheduledFor: fireDateMidnight })
    }
  }

  return firings
}
