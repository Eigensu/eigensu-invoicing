'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import {
  clients,
  projects,
  scheduleItems,
  invoices,
  invoiceLineItems,
  invoiceScheduleItems,
  settings,
} from '@eigensu/db/schema'
import { buildSchedule, amountToWords } from '@eigensu/core'
import type { ProjectConfig } from '@eigensu/core'
import { writeAuditLog } from '@/lib/audit'
import { allocateInvoiceNumber } from '@/lib/invoice-number'
import { withAuth } from '@/lib/auth/with-auth'

function toDate(s: string) {
  return new Date(s + 'T00:00:00')
}

const EngagementSchema = z.object({
  // Client
  clientMode: z.enum(['existing', 'new']),
  existingClientId: z.string().uuid().optional(),
  newClient: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      contactPerson: z.string().optional(),
      phone: z.string().optional(),
      billingAddress: z.string().optional(),
      gstId: z.string().optional(),
    })
    .optional(),
  // Project
  projectName: z.string().min(1),
  projectDescription: z.string().optional(),
  projectStart: z.string().date(),
  projectEnd: z.string().date().optional(),
  // Payment model
  paymentModel: z.enum(['one_time', 'installments', 'subscription', 'upfront_amc']),
  totalValue: z.number().int().positive().optional(),
  oneTimeDueDate: z.string().date().optional(),
  installments: z
    .array(z.object({ label: z.string().min(1), amount: z.number().positive().int(), dueDate: z.string().date() }))
    .optional(),
  subscriptionAmount: z.number().positive().int().optional(),
  subscriptionRecurrence: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  upfrontAmount: z.number().positive().int().optional(),
  upfrontDueDate: z.string().date().optional(),
  amcAmount: z.number().positive().int().optional(),
  amcRecurrence: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  // Invoice
  invoiceItemIndices: z.array(z.number().int().min(0)),
  bankAccountId: z.string().uuid(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  taxPercent: z.number().min(0).max(100).default(0),
})

export async function createEngagement(input: unknown) {
  return withAuth('projects:write', async (session) => {
    const data = EngagementSchema.parse(input)

    const [settingsRow] = await db.select().from(settings).limit(1)
    if (!settingsRow)
      return { success: false as const, error: 'Settings not configured — visit Admin → Settings first' }

    // Build schedule (pure, deterministic — same call will happen in the transaction)
    const config: ProjectConfig = {
      paymentModel: data.paymentModel,
      startDate: toDate(data.projectStart),
      ...(data.projectEnd ? { endDate: toDate(data.projectEnd) } : {}),
    }
    if (data.paymentModel === 'one_time') {
      config.oneTimeAmount = data.totalValue ?? 0
      if (data.oneTimeDueDate) config.oneTimeDueDate = toDate(data.oneTimeDueDate)
    } else if (data.paymentModel === 'installments') {
      config.installments = (data.installments ?? []).map((i) => ({
        label: i.label,
        amount: i.amount,
        dueDate: toDate(i.dueDate),
      }))
    } else if (data.paymentModel === 'subscription') {
      config.subscriptionAmount = data.subscriptionAmount ?? 0
      config.subscriptionRecurrence = data.subscriptionRecurrence ?? 'monthly'
    } else if (data.paymentModel === 'upfront_amc') {
      config.upfrontAmount = data.upfrontAmount ?? 0
      if (data.upfrontDueDate) config.upfrontDueDate = toDate(data.upfrontDueDate)
      config.amcAmount = data.amcAmount ?? 0
      config.amcRecurrence = data.amcRecurrence ?? 'yearly'
    }

    const drafts = buildSchedule(config)
    const computedTotal = drafts.reduce((a, d) => a + d.amount, 0)
    const totalValue = computedTotal > 0 ? computedTotal : (data.totalValue ?? 1)

    const invoiceNumber = await allocateInvoiceNumber(settingsRow.invoiceNumberFormat)

    let auditClientId: string | undefined

    const result = await db.transaction(async (tx) => {
      // 1. Resolve/create client
      let clientId: string
      if (data.clientMode === 'new') {
        if (!data.newClient) throw new Error('New client data required')
        const [client] = await tx.insert(clients).values(data.newClient).returning()
        if (!client) throw new Error('Failed to create client')
        clientId = client.id
        auditClientId = client.id
      } else {
        if (!data.existingClientId) throw new Error('No client selected')
        clientId = data.existingClientId
      }

      // 2. Create project
      const [project] = await tx
        .insert(projects)
        .values({
          clientId,
          name: data.projectName,
          ...(data.projectDescription ? { description: data.projectDescription } : {}),
          paymentModel: data.paymentModel,
          totalValue: String(totalValue),
          startDate: data.projectStart,
          ...(data.projectEnd ? { endDate: data.projectEnd } : {}),
          ...(data.amcAmount != null ? { amcAmount: String(data.amcAmount) } : {}),
          ...(data.amcRecurrence ? { amcRecurrence: data.amcRecurrence } : {}),
        })
        .returning()
      if (!project) throw new Error('Failed to create project')

      // 3. Insert schedule items (same order as drafts — indices stay aligned)
      let scheduleRows: { id: string; label: string; amount: string }[] = []
      if (drafts.length > 0) {
        scheduleRows = await tx
          .insert(scheduleItems)
          .values(
            drafts.map((d) => ({
              projectId: project.id,
              type: d.type,
              label: d.label,
              amount: String(d.amount),
              dueDate: d.dueDate.toISOString().split('T')[0] as string,
              recurrence: d.recurrence,
            })),
          )
          .returning({ id: scheduleItems.id, label: scheduleItems.label, amount: scheduleItems.amount })
      }

      // 4. Create invoice from selected indices
      const selectedItems = data.invoiceItemIndices
        .map((i) => scheduleRows[i])
        .filter((item): item is { id: string; label: string; amount: string } => item != null)

      const lineItemValues = selectedItems.map((si) => ({ description: si.label, amount: Number(si.amount) }))
      const subtotal = lineItemValues.reduce((a, li) => a + li.amount, 0)
      const tax = Math.floor((subtotal * data.taxPercent) / 100)
      const total = subtotal + tax

      const [invoice] = await tx
        .insert(invoices)
        .values({
          invoiceNumber,
          clientId,
          projectId: project.id,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          subtotal: String(subtotal),
          tax: String(tax),
          total: String(total),
          amountInWords: amountToWords(total),
          bankAccountId: data.bankAccountId,
          status: 'draft',
        })
        .returning()
      if (!invoice) throw new Error('Failed to create invoice')

      if (lineItemValues.length > 0) {
        await tx.insert(invoiceLineItems).values(
          lineItemValues.map((li, i) => ({
            invoiceId: invoice.id,
            description: li.description,
            amount: String(li.amount),
            sortOrder: i,
          })),
        )
      }

      if (selectedItems.length > 0) {
        await tx.insert(invoiceScheduleItems).values(
          selectedItems.map((si) => ({ invoiceId: invoice.id, scheduleItemId: si.id })),
        )
      }

      return { project, invoice, clientId }
    })

    // Audit after transaction commits
    if (auditClientId) {
      await writeAuditLog(session.authUid, 'CREATE_CLIENT', 'client', auditClientId, {
        name: data.newClient?.name,
      })
    }
    await writeAuditLog(session.authUid, 'CREATE_ENGAGEMENT', 'project', result.project.id, {
      name: data.projectName,
      invoiceNumber,
      scheduleItems: drafts.length,
    })

    return {
      success: true as const,
      data: {
        projectId: result.project.id,
        invoiceId: result.invoice.id,
        clientId: result.clientId,
        invoiceNumber,
      },
    }
  })
}
