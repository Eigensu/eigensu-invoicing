'use server'

import { z } from 'zod'
import { AuthError } from 'next-auth'
import { eq } from 'drizzle-orm'
import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from '@/auth'
import { writeAuditLog } from '@/lib/audit'
import { getSession } from '@/lib/auth/session'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function signIn(formData: FormData): Promise<{ error?: string }> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Invalid email or password.' }

  try {
    await nextAuthSignIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Invalid email or password.' }
    // Success surfaces as a NEXT_REDIRECT error — let Next.js handle it
    throw error
  }
  return {}
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  try {
    await nextAuthSignIn('google', { redirectTo: '/' })
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Could not start Google sign-in.' }
    // Success surfaces as a NEXT_REDIRECT error — let Next.js handle it
    throw error
  }
  return {}
}

const emailSchema = z.object({
  email: z.string().email(),
})

export async function requestPasswordReset(formData: FormData): Promise<{ success: true }> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') })

  if (parsed.success) {
    const email = parsed.data.email.toLowerCase()
    const user = await db.query.users.findFirst({ where: eq(users.email, email) })

    if (user && user.isActive) {
      const resetToken = crypto.randomUUID()
      const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await db
        .update(users)
        .set({ inviteToken: resetToken, inviteTokenExpiresAt: resetTokenExpiresAt })
        .where(eq(users.id, user.id))

      const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
      const resetUrl = `${appUrl}/set-password?token=${resetToken}`

      const { sendAlertEmail } = await import('@eigensu/email')
      await sendAlertEmail({
        to: [email],
        subject: 'Reset your Eigensu Billing password',
        htmlBody: `<p style="font-family:Arial,sans-serif">Hi ${user.name},</p>
<p style="font-family:Arial,sans-serif">We received a request to reset your Eigensu Billing password. Use the link below to set a new one (valid for 1 hour):</p>
<p style="font-family:Arial,sans-serif"><a href="${resetUrl}">${resetUrl}</a></p>
<p style="font-family:Arial,sans-serif">If you didn't request this, you can safely ignore this email.</p>`,
      })
    }
  }

  // Always report success, regardless of whether the email exists, so this
  // can't be used to enumerate registered accounts.
  return { success: true }
}

export async function signOut(): Promise<void> {
  const session = await getSession()

  if (session) {
    await writeAuditLog(session.user.id, 'user.logout')
  }

  await nextAuthSignOut({ redirectTo: '/login' })
}
