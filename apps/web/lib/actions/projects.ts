'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import { projects, scheduleItems } from '@eigensu/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { writeAuditLog } from '@/lib/audit'
import { buildSchedule } from '@eigensu/core'
import { withAuth } from '@/lib/auth/with-auth'

const InstallmentSchema = z.object({
  label: z.string().min(1),
  amount: z.number().positive().int(),
  dueDate: z.string().date(),
})

const ProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  paymentModel: z.enum(['one_time', 'installments', 'subscription', 'upfront_amc']),
  totalValue: z.number().positive().int(),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  oneTimeDueDate: z.string().date().optional(),
  installments: z.array(InstallmentSchema).optional(),
  subscriptionAmount: z.number().positive().int().optional(),
  subscriptionRecurrence: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  upfrontAmount: z.number().positive().int().optional(),
  upfrontDueDate: z.string().date().optional(),
  amcAmount: z.number().positive().int().optional(),
  amcRecurrence: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
})

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export async function createProject(input: unknown) {
  return withAuth('projects:write', async (session) => {
    const data = ProjectSchema.parse(input)

    // Build schedule first (pure computation, no DB) so it can't orphan the project row
    const drafts = buildSchedule({
      paymentModel: data.paymentModel,
      startDate: toDate(data.startDate),
      oneTimeAmount: data.totalValue,
      ...(data.endDate ? { endDate: toDate(data.endDate) } : {}),
      ...(data.oneTimeDueDate ? { oneTimeDueDate: toDate(data.oneTimeDueDate) } : {}),
      ...(data.installments
        ? { installments: data.installments.map((i) => ({ ...i, dueDate: toDate(i.dueDate) })) }
        : {}),
      ...(data.subscriptionAmount != null ? { subscriptionAmount: data.subscriptionAmount } : {}),
      ...(data.subscriptionRecurrence ? { subscriptionRecurrence: data.subscriptionRecurrence } : {}),
      ...(data.upfrontAmount != null ? { upfrontAmount: data.upfrontAmount } : {}),
      ...(data.upfrontDueDate ? { upfrontDueDate: toDate(data.upfrontDueDate) } : {}),
      ...(data.amcAmount != null ? { amcAmount: data.amcAmount } : {}),
      ...(data.amcRecurrence ? { amcRecurrence: data.amcRecurrence } : {}),
    })

    const project = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(projects)
        .values({
          clientId: data.clientId,
          name: data.name,
          description: data.description,
          paymentModel: data.paymentModel,
          totalValue: String(data.totalValue),
          startDate: data.startDate,
          endDate: data.endDate,
          amcAmount: data.amcAmount != null ? String(data.amcAmount) : undefined,
          amcRecurrence: data.amcRecurrence,
        })
        .returning()
      if (!p) throw new Error('Failed to create project')

      if (drafts.length > 0) {
        await tx.insert(scheduleItems).values(
          drafts.map((d) => ({
            projectId: p.id,
            type: d.type,
            label: d.label,
            amount: String(d.amount),
            dueDate: d.dueDate.toISOString().split('T')[0]!,
            recurrence: d.recurrence,
          })),
        )
      }

      return p
    })

    await writeAuditLog(session.authUid, 'CREATE_PROJECT', 'project', project.id, {
      name: project.name,
      scheduleItems: drafts.length,
    })

    return { success: true as const, data: project }
  })
}

export async function updateProject(id: string, input: unknown) {
  return withAuth('projects:write', async (session) => {
    const data = ProjectSchema.partial().parse(input)

    const [project] = await db
      .update(projects)
      .set({
        name: data.name,
        description: data.description,
        endDate: data.endDate,
        amcAmount: data.amcAmount != null ? String(data.amcAmount) : undefined,
        amcRecurrence: data.amcRecurrence,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning()

    if (!project) return { success: false as const, error: 'Project not found' }

    if (data.paymentModel || data.installments || data.subscriptionAmount || data.amcAmount || data.endDate) {
      await db
        .delete(scheduleItems)
        .where(and(eq(scheduleItems.projectId, id), inArray(scheduleItems.status, ['pending', 'cancelled'])))

      if (data.paymentModel && data.startDate) {
        const drafts = buildSchedule({
          paymentModel: project.paymentModel,
          startDate: toDate(project.startDate),
          ...(project.endDate ? { endDate: toDate(project.endDate) } : {}),
          ...(data.installments
            ? { installments: data.installments.map((i) => ({ ...i, dueDate: toDate(i.dueDate) })) }
            : {}),
          ...(data.subscriptionAmount != null ? { subscriptionAmount: data.subscriptionAmount } : {}),
          ...(data.subscriptionRecurrence ? { subscriptionRecurrence: data.subscriptionRecurrence } : {}),
          ...(data.upfrontAmount != null ? { upfrontAmount: data.upfrontAmount } : {}),
          ...(data.upfrontDueDate ? { upfrontDueDate: toDate(data.upfrontDueDate) } : {}),
          ...(data.amcAmount != null ? { amcAmount: data.amcAmount } : {}),
          ...((data.amcRecurrence ?? project.amcRecurrence)
            ? { amcRecurrence: (data.amcRecurrence ?? project.amcRecurrence)! }
            : {}),
        })

        if (drafts.length > 0) {
          await db.insert(scheduleItems).values(
            drafts.map((d) => ({
              projectId: id,
              type: d.type,
              label: d.label,
              amount: String(d.amount),
              dueDate: d.dueDate.toISOString().split('T')[0]!,
              recurrence: d.recurrence,
            })),
          )
        }
      }
    }

    await writeAuditLog(session.authUid, 'UPDATE_PROJECT', 'project', id, data)
    return { success: true as const, data: project }
  })
}
