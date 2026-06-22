import { requireSession } from './session'
import { hasPermission } from './roles'
import type { Permission } from './roles'
import type { Session } from './session'

type Forbidden = { success: false; error: 'Forbidden' }

export async function withAuth<T>(
  permission: Permission,
  handler: (session: Session) => Promise<T>,
): Promise<T | Forbidden> {
  const session = await requireSession()
  if (!hasPermission(session, permission))
    return { success: false as const, error: 'Forbidden' as const }
  return handler(session)
}
