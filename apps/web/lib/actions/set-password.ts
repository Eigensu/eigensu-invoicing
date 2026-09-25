'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

const INVALID_TOKEN_ERROR = 'This invite link is invalid or has expired.'

export async function setPassword(formData: FormData): Promise<{ error?: string }> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.inviteToken, parsed.data.token),
  })

  if (
    !user ||
    !user.isActive ||
    !user.inviteTokenExpiresAt ||
    user.inviteTokenExpiresAt.getTime() < Date.now()
  ) {
    return { error: INVALID_TOKEN_ERROR }
  }

  const passwordHash = await hash(parsed.data.password, 12)

  await db
    .update(users)
    .set({ passwordHash, inviteToken: null, inviteTokenExpiresAt: null })
    .where(eq(users.id, user.id))

  redirect('/login')
}
