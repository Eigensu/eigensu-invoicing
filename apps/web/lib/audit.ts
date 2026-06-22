import { db } from '@eigensu/db'
import { auditLog } from '@eigensu/db/schema'

export async function writeAuditLog(
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({
    userId: userId ?? undefined,
    action,
    entityType: entityType ?? undefined,
    entityId: entityId ?? undefined,
    meta: meta ?? null,
  })
}
