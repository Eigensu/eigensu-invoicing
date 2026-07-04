'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import { settings, bankAccounts, reminderRules, users, invoices } from '@eigensu/db/schema'
import { eq, and, not } from 'drizzle-orm'
import { writeAuditLog } from '@/lib/audit'
import { withAuth } from '@/lib/auth/with-auth'

// ─── Settings ────────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  companyName: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logoUrl: z.string().optional(),
  defaultTaxPercent: z.number().min(0).max(100).optional(),
  defaultCurrency: z.string().min(1).optional(),
  invoiceNumberFormat: z.string().optional(),
  defaultDueDays: z.number().int().positive().optional(),
  declarationText: z.string().optional(),
  founderEmails: z.array(z.string().email()).max(5).optional(),
  autoSendRecurring: z.boolean().optional(),
})

export async function updateSettings(input: unknown) {
  return withAuth('settings:write', async (session) => {
    const data = SettingsSchema.parse(input)
    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1)
    if (!existing) return { success: false as const, error: 'Settings row not found. Run seed.' }

    await db
      .update(settings)
      .set({
        ...data,
        defaultTaxPercent:
          data.defaultTaxPercent != null ? String(data.defaultTaxPercent) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing.id))

    await writeAuditLog(session.authUid, 'UPDATE_SETTINGS', 'settings', existing.id, data)
    return { success: true as const }
  })
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

export async function uploadLogo(formData: FormData) {
  return withAuth('settings:write', async (session) => {
    const file = formData.get('logo')
    if (!(file instanceof File) || file.size === 0) {
      return { success: false as const, error: 'No file provided' }
    }
    if (!file.type.startsWith('image/')) {
      return { success: false as const, error: 'Logo must be an image' }
    }
    if (file.size > MAX_LOGO_BYTES) {
      return { success: false as const, error: 'Logo must be smaller than 2 MB' }
    }

    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1)
    if (!existing) return { success: false as const, error: 'Settings row not found' }

    const { cloudinary } = await import('@/lib/cloudinary')
    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`

    // Fixed public_id so old logos are overwritten instead of accumulating
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'eigensu-billing/branding',
      public_id: 'company-logo',
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
    })

    await db
      .update(settings)
      .set({ logoUrl: result.secure_url, updatedAt: new Date() })
      .where(eq(settings.id, existing.id))

    await writeAuditLog(session.authUid, 'UPLOAD_LOGO', 'settings', existing.id)
    return { success: true as const, logoUrl: result.secure_url }
  })
}

// ─── Bank Accounts ────────────────────────────────────────────────────────────

const BankAccountSchema = z.object({
  id: z.string().uuid().optional(),
  holderName: z.string().min(1),
  accountNumber: z.string().min(1),
  ifsc: z.string().min(11).max(11),
  upiId: z.string().optional(),
  label: z.string().min(1),
  isDefault: z.boolean().default(false),
})

export async function upsertBankAccount(input: unknown) {
  return withAuth('bank-accounts:write', async (session) => {
    const data = BankAccountSchema.parse(input)

    if (data.isDefault) {
      await db
        .update(bankAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          data.id
            ? and(eq(bankAccounts.isDefault, true), not(eq(bankAccounts.id, data.id)))
            : eq(bankAccounts.isDefault, true),
        )
    }

    let result
    if (data.id) {
      const { id, ...rest } = data
      ;[result] = await db
        .update(bankAccounts)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id))
        .returning()
    } else {
      const { id: _id, ...rest } = data
      ;[result] = await db.insert(bankAccounts).values(rest).returning()
    }

    await writeAuditLog(
      session.authUid,
      data.id ? 'UPDATE_BANK_ACCOUNT' : 'CREATE_BANK_ACCOUNT',
      'bank_account',
      result?.id,
      { label: data.label },
    )

    return { success: true as const, data: result }
  })
}

export async function setDefaultBankAccount(id: string) {
  return withAuth('bank-accounts:write', async (session) => {
    await db.transaction(async (tx) => {
      await tx
        .update(bankAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(bankAccounts.isDefault, true))
      await tx
        .update(bankAccounts)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id))
    })
    await writeAuditLog(session.authUid, 'SET_DEFAULT_BANK_ACCOUNT', 'bank_account', id)
    return { success: true as const }
  })
}

export async function deleteBankAccount(id: string) {
  return withAuth('bank-accounts:write', async (session) => {
    const referenced = await db.query.invoices.findFirst({
      where: eq(invoices.bankAccountId, id),
      columns: { id: true },
    })
    if (referenced) {
      return {
        success: false as const,
        error: 'This bank account is used by one or more invoices and cannot be deleted.',
      }
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id))
    await writeAuditLog(session.authUid, 'DELETE_BANK_ACCOUNT', 'bank_account', id)
    return { success: true as const }
  })
}

// ─── Reminder Rules ───────────────────────────────────────────────────────────

const ReminderRuleSchema = z.object({
  id: z.string().uuid().optional(),
  offsetDays: z.number().int(),
  enabled: z.boolean(),
  subject: z.string().min(1),
  bodyTemplate: z.string().min(1),
  ccFounders: z.boolean(),
})

export async function upsertReminderRule(input: unknown) {
  return withAuth('reminder-rules:write', async (session) => {
    const data = ReminderRuleSchema.parse(input)

    if (!data.id)
      return { success: false as const, error: 'Cannot create new reminder rules without a type' }

    const { id, ...rest } = data
    const [result] = await db
      .update(reminderRules)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(reminderRules.id, id))
      .returning()

    await writeAuditLog(session.authUid, 'UPDATE_REMINDER_RULE', 'reminder_rule', result?.id)
    return { success: true as const, data: result }
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'viewer', 'accountant']),
})

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function inviteUser(input: unknown) {
  return withAuth('users:write', async (session) => {
    const data = InviteUserSchema.parse(input)
    const email = data.email.toLowerCase()

    const inviteToken = crypto.randomUUID()
    const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS)

    const [inserted] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email,
        name: data.name,
        role: data.role,
        passwordHash: null,
        inviteToken,
        inviteTokenExpiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: users.id })

    if (!inserted) {
      return { success: false as const, error: 'A user with this email already exists.' }
    }

    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
    const setPasswordUrl = `${appUrl}/set-password?token=${inviteToken}`

    const { sendAlertEmail } = await import('@eigensu/email')
    await sendAlertEmail({
      to: [email],
      subject: 'You have been invited to Eigensu Billing',
      htmlBody: `<p style="font-family:Arial,sans-serif">Hi ${data.name},</p>
<p style="font-family:Arial,sans-serif">You have been invited to Eigensu Billing. Set your password using the link below (valid for 7 days):</p>
<p style="font-family:Arial,sans-serif"><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>`,
    })

    await writeAuditLog(session.authUid, 'INVITE_USER', 'user', inserted.id, {
      email,
      role: data.role,
    })

    return { success: true as const }
  })
}

export async function updateUserRole(userId: string, role: 'admin' | 'viewer' | 'accountant') {
  return withAuth('users:write', async (session) => {
    if (userId === session.authUid)
      return { success: false as const, error: 'Cannot change your own role' }

    const [user] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning()
    if (!user) return { success: false as const, error: 'User not found' }

    await writeAuditLog(session.authUid, 'UPDATE_USER_ROLE', 'user', userId, { role })
    return { success: true as const }
  })
}

export async function revokeUser(userId: string) {
  return withAuth('users:write', async (session) => {
    if (userId === session.authUid)
      return { success: false as const, error: 'Cannot revoke your own access' }

    // Soft revoke: keeps audit_log.userId references valid forever
    const [user] = await db
      .update(users)
      .set({ isActive: false, inviteToken: null, inviteTokenExpiresAt: null })
      .where(eq(users.id, userId))
      .returning()
    if (!user) return { success: false as const, error: 'User not found' }

    await writeAuditLog(session.authUid, 'REVOKE_USER', 'user', userId)
    return { success: true as const }
  })
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendTestEmail() {
  return withAuth('settings:write', async (session) => {
    const { sendAlertEmail } = await import('@eigensu/email')
    await sendAlertEmail({
      to: [session.user.email],
      subject: 'Test Email — Eigensu Billing',
      htmlBody:
        '<p style="font-family:Arial,sans-serif">Your email configuration is working correctly. This is a test message from Eigensu Billing.</p>',
    })
    return { success: true as const }
  })
}
