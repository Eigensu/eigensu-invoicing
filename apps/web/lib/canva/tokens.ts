import { db } from '@eigensu/db'
import { canvaConnection } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { refreshTokens } from './oauth'

// Refresh a bit before actual expiry to absorb request latency + clock drift.
const EXPIRY_SAFETY_MARGIN_MS = 60_000

export async function getCanvaConnection() {
  const [row] = await db.select().from(canvaConnection).limit(1)
  return row ?? null
}

// Returns a currently-valid access token, refreshing and persisting the
// rotated token pair first if the stored one is expired or about to be.
// Throws if Canva has never been connected — callers should treat that as
// "fall back to the non-Canva PDF path", not a hard failure.
export async function getValidAccessToken(): Promise<string> {
  const row = await getCanvaConnection()
  if (!row) throw new Error('Canva is not connected')

  const expiresSoon = row.expiresAt.getTime() - EXPIRY_SAFETY_MARGIN_MS <= Date.now()
  if (!expiresSoon) return row.accessToken

  const tokens = await refreshTokens(row.refreshToken)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  await db
    .update(canvaConnection)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      updatedAt: new Date(),
    })
    .where(eq(canvaConnection.id, row.id))

  return tokens.access_token
}
