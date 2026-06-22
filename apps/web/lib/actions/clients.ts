'use server'

import { z } from 'zod'
import { db } from '@eigensu/db'
import { clients } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '@/lib/audit'
import { withAuth } from '@/lib/auth/with-auth'

const ClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Valid email required'),
  billingAddress: z.string().optional(),
  gstId: z.string().optional(),
  notes: z.string().optional(),
})

export async function createClient(input: unknown) {
  return withAuth('clients:write', async (session) => {
    const data = ClientSchema.parse(input)
    const [client] = await db.insert(clients).values(data).returning()
    if (!client) throw new Error('Failed to create client')
    await writeAuditLog(session.authUid, 'CREATE_CLIENT', 'client', client.id, { name: client.name })
    return { success: true as const, data: client }
  })
}

export async function updateClient(id: string, input: unknown) {
  return withAuth('clients:write', async (session) => {
    const data = ClientSchema.partial().parse(input)
    const [client] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning()
    if (!client) return { success: false as const, error: 'Client not found' }
    await writeAuditLog(session.authUid, 'UPDATE_CLIENT', 'client', id, data)
    return { success: true as const, data: client }
  })
}

export async function archiveClient(id: string) {
  return withAuth('clients:write', async (session) => {
    const [client] = await db
      .update(clients)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning()
    if (!client) return { success: false as const, error: 'Client not found' }
    await writeAuditLog(session.authUid, 'ARCHIVE_CLIENT', 'client', id)
    return { success: true as const }
  })
}
