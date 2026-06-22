import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'

export async function linkUserOnFirstLogin(
  authUid: string,
  email: string,
): Promise<boolean> {
  // Check if the UID is already linked
  const existing = await db.query.users.findFirst({
    where: eq(users.id, authUid),
  })
  if (existing) return true

  // Try to match by email (seeded founder rows have placeholder UIDs)
  const result = await db
    .update(users)
    .set({ id: authUid })
    .where(eq(users.email, email))
    .returning()

  return result.length > 0
}
