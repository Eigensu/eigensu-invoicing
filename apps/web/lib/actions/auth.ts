'use server'

import { z } from 'zod'
import { AuthError } from 'next-auth'
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from '@/auth'
import { writeAuditLog } from '@/lib/audit'
import { getSession } from '@/lib/auth/session'

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

export async function signOut(): Promise<void> {
  const session = await getSession()

  if (session) {
    await writeAuditLog(session.user.id, 'user.logout')
  }

  await nextAuthSignOut({ redirectTo: '/login' })
}
