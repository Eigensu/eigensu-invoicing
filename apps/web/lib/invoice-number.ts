import { db } from '@eigensu/db'
import { invoiceSequences } from '@eigensu/db/schema'
import { formatInvoiceNumber } from '@eigensu/core'
import { sql } from 'drizzle-orm'

export async function allocateInvoiceNumber(format: string): Promise<string> {
  const year = new Date().getFullYear()

  const result = await db
    .insert(invoiceSequences)
    .values({ year, lastSeq: 1 })
    .onConflictDoUpdate({
      target: invoiceSequences.year,
      set: { lastSeq: sql`${invoiceSequences.lastSeq} + 1` },
    })
    .returning({ seq: invoiceSequences.lastSeq })

  const seq = result[0]?.seq
  if (seq == null) throw new Error('Failed to allocate invoice sequence number')

  return formatInvoiceNumber(seq, year, format)
}
