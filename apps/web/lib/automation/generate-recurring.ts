import { db } from '@eigensu/db'
import {
  scheduleItems,
  invoiceScheduleItems,
  invoices,
  settings,
  bankAccounts,
} from '@eigensu/db/schema'
import { and, eq, lte, notInArray, inArray, sql } from 'drizzle-orm'
import { amountToWords, formatINR } from '@eigensu/core'
import { allocateInvoiceNumber } from '@/lib/invoice-number'
import { writeAuditLog } from '@/lib/audit'
import { dateToISO } from './today-ist'

const PER_RUN_CAP = 50

export async function generateRecurringInvoices(todayIST: Date): Promise<number> {
  const todayStr = dateToISO(todayIST)

  const [settingsRow] = await db.select().from(settings).limit(1)
  if (!settingsRow) return 0

  const [defaultBank] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.isDefault, true))
    .limit(1)
  if (!defaultBank) return 0

  // Find linked schedule item IDs (already have an invoice)
  const linked = await db
    .select({ scheduleItemId: invoiceScheduleItems.scheduleItemId })
    .from(invoiceScheduleItems)

  const linkedIds = linked.map((l) => l.scheduleItemId)

  // Pending recurring items due today or before with no invoice
  const whereClause = and(
    inArray(scheduleItems.type, ['amc', 'subscription']),
    eq(scheduleItems.status, 'pending'),
    lte(scheduleItems.dueDate, todayStr),
    linkedIds.length > 0
      ? notInArray(scheduleItems.id, linkedIds)
      : sql`true`,
  )

  const dueItems = await db.query.scheduleItems.findMany({
    where: whereClause,
    with: { project: { with: { client: true } } },
    limit: PER_RUN_CAP,
  })

  let generated = 0

  for (const item of dueItems) {
    try {
      const amount = Number(item.amount)
      const words = amountToWords(amount)

      const invoiceNumber = await allocateInvoiceNumber(settingsRow.invoiceNumberFormat)
      const dueDate = new Date(item.dueDate)
      dueDate.setDate(dueDate.getDate() + settingsRow.defaultDueDays)

      const [invoice] = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          clientId: item.project.clientId,
          projectId: item.projectId,
          issueDate: todayStr,
          dueDate: dateToISO(dueDate),
          subtotal: item.amount,
          tax: '0',
          total: item.amount,
          amountInWords: words,
          bankAccountId: defaultBank.id,
          status: settingsRow.autoSendRecurring ? 'sent' : 'draft',
        })
        .returning()

      if (!invoice) continue

      // Line item
      await db.insert(
        (await import('@eigensu/db/schema')).invoiceLineItems,
      ).values({
        invoiceId: invoice.id,
        description: item.label,
        amount: item.amount,
        sortOrder: 0,
      })

      // Link schedule item
      await db.insert(invoiceScheduleItems).values({
        invoiceId: invoice.id,
        scheduleItemId: item.id,
      })

      if (settingsRow.autoSendRecurring) {
        // Auto-send: import email module and send
        try {
          const { sendInvoiceEmail } = await import('@eigensu/email')

          // Generate PDF for attachment — non-fatal if render fails
          let pdfBuffer: Buffer | undefined
          try {
            const fullInv = await db.query.invoices.findFirst({
              where: eq(invoices.id, invoice.id),
              with: { client: true, lineItems: true, bankAccount: true },
            })
            if (fullInv) {
              const { generateInvoicePDF } = await import('@/lib/invoice-pdf')
              const { buildInvoiceRenderData } = await import('@/lib/invoice-render-data')
              pdfBuffer = await generateInvoicePDF(
                buildInvoiceRenderData(fullInv, settingsRow),
                `Invoice ${invoiceNumber}`,
              )
            }
          } catch (pdfErr) {
            console.error('PDF generation failed (sending without attachment):', pdfErr)
          }

          await sendInvoiceEmail({
            to: item.project.client.email,
            invoiceId: invoice.id,
            invoiceNumber,
            clientName: item.project.client.name,
            amount: formatINR(amount),
            dueDate: dateToISO(dueDate),
            companyName: settingsRow.companyName,
            companyEmail: settingsRow.email,
            companyPhone: settingsRow.phone,
            bankAccount: defaultBank,
            cc: settingsRow.founderEmails,
            ...(pdfBuffer !== undefined ? { pdfBuffer } : {}),
          })
          await db
            .update(invoices)
            .set({ sentAt: new Date() })
            .where(eq(invoices.id, invoice.id))
        } catch (emailErr) {
          console.error('Auto-send failed for invoice', invoiceNumber, emailErr)
        }
      }

      generated++
    } catch (err) {
      await writeAuditLog(null, 'CRON_GENERATE_ERROR', 'schedule_item', item.id, {
        error: String(err),
      })
    }
  }

  return generated
}
