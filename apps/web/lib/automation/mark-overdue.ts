import { db } from '@eigensu/db'
import { invoices, scheduleItems, invoiceScheduleItems } from '@eigensu/db/schema'
import { and, inArray, lt, notInArray, sql } from 'drizzle-orm'
import { dateToISO } from './today-ist'

export async function markOverdue(todayIST: Date): Promise<number> {
  const todayStr = dateToISO(todayIST)

  // Invoices: sent or partial, past due
  const updatedInvoices = await db
    .update(invoices)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(
      and(
        inArray(invoices.status, ['sent', 'partial']),
        lt(invoices.dueDate, todayStr),
      ),
    )
    .returning({ id: invoices.id })

  // Schedule items: pending, past due, not linked to any invoice
  const linked = await db
    .select({ scheduleItemId: invoiceScheduleItems.scheduleItemId })
    .from(invoiceScheduleItems)

  const linkedIds = linked.map((l) => l.scheduleItemId)

  await db
    .update(scheduleItems)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(
      and(
        inArray(scheduleItems.status, ['pending']),
        lt(scheduleItems.dueDate, todayStr),
        linkedIds.length > 0
          ? notInArray(scheduleItems.id, linkedIds)
          : sql`true`,
      ),
    )

  return updatedInvoices.length
}
