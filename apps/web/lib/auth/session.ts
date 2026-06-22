import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import type { User } from '@eigensu/db'
import { linkUserOnFirstLogin } from '@/lib/auth/link-user'

export interface Session {
  authUid: string
  user: User
}

export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  let user = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
  })

  // First-login: seeded row has a placeholder UID — link it to the real auth UID.
  // Runs here (server component / Node.js) not in middleware (Edge) so Drizzle works.
  if (!user && authUser.email) {
    await linkUserOnFirstLogin(authUser.id, authUser.email).catch(() => null)
    user = await db.query.users.findFirst({ where: eq(users.id, authUser.id) })
  }

  if (!user) return null
  return { authUid: authUser.id, user }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
