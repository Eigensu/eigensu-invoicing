import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDb | undefined

function createClient(): DrizzleDb {
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL is not set')
  const conn = postgres(url, { prepare: false })
  return drizzle(conn, { schema })
}

// Lazy singleton — does not throw at import time (safe for next build)
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop: string | symbol) {
    if (!_db) _db = createClient()
    const val = Reflect.get(_db, prop, _db)
    return typeof val === 'function'
      ? (val as (...a: unknown[]) => unknown).bind(_db)
      : val
  },
})

export type Db = DrizzleDb
