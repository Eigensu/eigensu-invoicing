import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import type { User } from '@eigensu/db'

export interface Session {
  authUid: string
  user: User
}

export async function getSession(): Promise<Session | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user || !user.isActive) return null
  return { authUid: user.id, user }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
