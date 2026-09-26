import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@eigensu/db'
import { canvaConnection } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { exchangeCodeForTokens } from '@/lib/canva/oauth'
import { getDefaultCanvaBrandTemplateId } from '@/lib/canva/config'
import { writeAuditLog } from '@/lib/audit'

const VERIFIER_COOKIE = 'canva_oauth_verifier'
const STATE_COOKIE = 'canva_oauth_state'
const SETTINGS_PATH = '/admin/settings'

export async function GET(request: NextRequest) {
  const session = await requireSession()
  if (!hasPermission(session, 'settings:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  const verifier = cookieStore.get(VERIFIER_COOKIE)?.value
  cookieStore.delete(VERIFIER_COOKIE)
  cookieStore.delete(STATE_COOKIE)

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${SETTINGS_PATH}?canva_error=${reason}`, request.url))

  if (error) return fail(error)
  if (!code || !state || !verifier || !expectedState) return fail('missing_params')
  if (state !== expectedState) return fail('state_mismatch')

  let tokens
  try {
    tokens = await exchangeCodeForTokens(code, verifier)
  } catch (err) {
    console.error('Canva token exchange failed:', err)
    return fail('token_exchange_failed')
  }

  const [existing] = await db.select().from(canvaConnection).limit(1)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  if (existing) {
    await db
      .update(canvaConnection)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope,
        connectedByUserId: session.authUid,
        updatedAt: new Date(),
      })
      .where(eq(canvaConnection.id, existing.id))
  } else {
    const brandTemplateId = getDefaultCanvaBrandTemplateId()
    if (!brandTemplateId) return fail('missing_brand_template_id')

    await db.insert(canvaConnection).values({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      brandTemplateId,
      connectedByUserId: session.authUid,
    })
  }

  await writeAuditLog(session.authUid, 'CONNECT_CANVA', 'canva_connection', existing?.id)

  return NextResponse.redirect(new URL(`${SETTINGS_PATH}?canva_connected=1`, request.url))
}
