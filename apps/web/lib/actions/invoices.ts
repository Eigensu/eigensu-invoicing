'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import {
  invoices,
  invoiceLineItems,
  invoiceScheduleItems,
  settings,
  reminders,
  reminderRules,
} from '@eigensu/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { writeAuditLog } from '@/lib/audit'
import { allocateInvoiceNumber } from '@/lib/invoice-number'
import { amountToWords, formatINR, addAmounts, computeInvoiceOutstanding } from '@eigensu/core'
import { withAuth } from '@/lib/auth/with-auth'

const LineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive().int(),
  sortOrder: z.number().int().default(0),
})

const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  scheduleItemIds: z.array(z.string().uuid()).optional(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  bankAccountId: z.string().uuid(),
  taxPercent: z.number().min(0).max(100).default(0),
  lineItems: z.array(LineItemSchema).min(1, 'At least one line item required'),
})

export async function createInvoice(input: unknown) {
  return withAuth('invoices:write', async (session) => {
    const data = CreateInvoiceSchema.parse(input)

    const subtotal = data.lineItems.reduce((sum, li) => addAmounts(sum, li.amount), 0)
    const tax = Math.floor((subtotal * data.taxPercent) / 100)
    const total = addAmounts(subtotal, tax)

    if (!Number.isInteger(total)) {
      return { success: false as const, error: 'Invoice total must be whole rupees' }
    }

    const words = amountToWords(total)

    const [settingsRow] = await db.select().from(settings).limit(1)
    if (!settingsRow) return { success: false as const, error: 'Settings not configured' }

    const invoiceNumber = await allocateInvoiceNumber(settingsRow.invoiceNumberFormat)

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        clientId: data.clientId,
        projectId: data.projectId,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: String(subtotal),
        tax: String(tax),
        total: String(total),
        amountInWords: words,
        bankAccountId: data.bankAccountId,
        status: 'draft',
      })
      .returning()
    if (!invoice) throw new Error('Failed to create invoice')

    await db.insert(invoiceLineItems).values(
      data.lineItems.map((li, i) => ({
        invoiceId: invoice.id,
        description: li.description,
        amount: String(li.amount),
        sortOrder: li.sortOrder ?? i,
      })),
    )

    if (data.scheduleItemIds && data.scheduleItemIds.length > 0) {
      await db.insert(invoiceScheduleItems).values(
        data.scheduleItemIds.map((sid) => ({ invoiceId: invoice.id, scheduleItemId: sid })),
      )
    }

    await writeAuditLog(session.authUid, 'CREATE_INVOICE', 'invoice', invoice.id, {
      invoiceNumber,
      total,
    })

    return { success: true as const, data: invoice }
  })
}

export async function sendInvoice(invoiceId: string) {
  return withAuth('invoices:write', async (session) => {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: { client: true, lineItems: true, bankAccount: true },
    })
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    if (invoice.status === 'cancelled')
      return { success: false as const, error: 'Cannot send a cancelled invoice' }

    const [settingsRow] = await db.select().from(settings).limit(1)
    if (!settingsRow) return { success: false as const, error: 'Settings not configured' }

    const dueRule = await db.query.reminderRules.findFirst({
      where: and(eq(reminderRules.type, 'client_due'), eq(reminderRules.offsetDays, 0)),
    })

    // Generate PDF for attachment — non-fatal if render fails
    let pdfBuffer: Buffer | undefined
    try {
      const { generateInvoicePDF } = await import('@/lib/invoice-pdf')
      const { buildInvoiceRenderData } = await import('@/lib/invoice-render-data')
      pdfBuffer = await generateInvoicePDF(
        buildInvoiceRenderData(invoice, settingsRow),
        `Invoice ${invoice.invoiceNumber}`,
      )
    } catch (pdfErr) {
      console.error('PDF generation failed (sending without attachment):', pdfErr)
    }

    try {
      const { sendInvoiceEmail } = await import('@eigensu/email')
      await sendInvoiceEmail({
        to: invoice.client.email,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        amount: formatINR(Number(invoice.total)),
        dueDate: invoice.dueDate,
        companyName: settingsRow.companyName,
        companyEmail: settingsRow.email,
        companyPhone: settingsRow.phone,
        bankAccount: invoice.bankAccount,
        cc: settingsRow.founderEmails,
        ...(pdfBuffer !== undefined ? { pdfBuffer } : {}),
      })
    } catch (err) {
      console.error('Email send failed:', err)
      return { success: false as const, error: 'Failed to send email' }
    }

    // Only flip status on the initial send (draft → sent).
    // Re-sends on already-sent/partial/overdue invoices update sentAt only,
    // so a partial payment is not wiped from the status.
    if (invoice.status === 'draft') {
      await db
        .update(invoices)
        .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
    } else {
      await db
        .update(invoices)
        .set({ sentAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
    }

    if (dueRule) {
      await db
        .insert(reminders)
        .values({
          ruleId: dueRule.id,
          type: 'client_due',
          invoiceId,
          scheduledFor: invoice.dueDate,
          status: 'sent',
          sentAt: new Date(),
          recipients: [invoice.client.email],
          retryCount: 0,
        })
        .onConflictDoNothing()
    }

    await writeAuditLog(session.authUid, 'SEND_INVOICE', 'invoice', invoiceId, {
      to: invoice.client.email,
    })

    return { success: true as const }
  })
}

export async function cancelInvoice(invoiceId: string) {
  return withAuth('invoices:write', async (session) => {
    const [invoice] = await db
      .update(invoices)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), inArray(invoices.status, ['draft'])))
      .returning()

    if (!invoice)
      return { success: false as const, error: 'Invoice not found or not in draft status' }

    await writeAuditLog(session.authUid, 'CANCEL_INVOICE', 'invoice', invoiceId)
    return { success: true as const }
  })
}

export async function getInvoiceOutstanding(invoiceId: string): Promise<number> {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { payments: true },
  })
  if (!invoice) return 0
  return computeInvoiceOutstanding(
    Number(invoice.total),
    invoice.payments.map((p) => ({ amount: Number(p.amount) })),
  )
}
