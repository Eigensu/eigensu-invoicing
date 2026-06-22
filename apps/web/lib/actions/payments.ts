'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import { payments, invoices, invoiceScheduleItems, scheduleItems } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '@/lib/audit'
import { addAmounts, subtractAmounts } from '@eigensu/core'
import { withAuth } from '@/lib/auth/with-auth'

type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'

const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive().int(),
  dateReceived: z.string().date(),
  mode: z.enum(['bank', 'upi', 'cash', 'other']).default('bank'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export async function recordPayment(input: unknown) {
  return withAuth('payments:write', async (session) => {
    const data = RecordPaymentSchema.parse(input)

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, data.invoiceId),
      with: { payments: true },
    })
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    if (invoice.status === 'cancelled' || invoice.status === 'paid') {
      return { success: false as const, error: `Cannot record payment on ${invoice.status} invoice` }
    }

    const previousTotal = invoice.payments.reduce((sum, p) => addAmounts(sum, Number(p.amount)), 0)
    const newTotal = addAmounts(previousTotal, data.amount)
    const invoiceTotal = Number(invoice.total)

    if (newTotal > invoiceTotal) {
      return {
        success: false as const,
        error: `Payment would exceed invoice total. Outstanding: ${subtractAmounts(invoiceTotal, previousTotal)}`,
      }
    }

    const newStatus: InvoiceStatus =
      newTotal >= invoiceTotal ? 'paid' : newTotal > 0 ? 'partial' : invoice.status

    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: data.invoiceId,
        amount: String(data.amount),
        dateReceived: data.dateReceived,
        mode: data.mode,
        reference: data.reference,
        notes: data.notes,
      })
      .returning()

    await db
      .update(invoices)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(invoices.id, data.invoiceId))

    if (newStatus === 'paid') {
      const links = await db.query.invoiceScheduleItems.findMany({
        where: eq(invoiceScheduleItems.invoiceId, data.invoiceId),
      })
      for (const link of links) {
        await db
          .update(scheduleItems)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(eq(scheduleItems.id, link.scheduleItemId))
      }
    }

    await writeAuditLog(session.authUid, 'RECORD_PAYMENT', 'payment', payment?.id, {
      invoiceId: data.invoiceId,
      amount: data.amount,
      newStatus,
    })

    return {
      success: true as const,
      data: {
        payment,
        newInvoiceStatus: newStatus,
        outstanding: subtractAmounts(invoiceTotal, newTotal),
      },
    }
  })
}
