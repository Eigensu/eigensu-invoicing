'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) return { error: 'Invalid email or password.' }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const session = await getSession()
  const supabase = await createSupabaseServerClient()

  if (session) {
    await writeAuditLog(session.user.id, 'user.logout')
  }

  await supabase.auth.signOut()
  redirect('/login')
}
