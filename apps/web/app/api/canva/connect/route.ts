import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { generatePkcePair, buildAuthorizeUrl } from '@/lib/canva/oauth'

const VERIFIER_COOKIE = 'canva_oauth_verifier'
const STATE_COOKIE = 'canva_oauth_state'

export async function GET() {
  const session = await requireSession()
  if (!hasPermission(session, 'settings:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { verifier, challenge } = generatePkcePair()
  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 600,
    path: '/',
  }
  cookieStore.set(VERIFIER_COOKIE, verifier, cookieOptions)
  cookieStore.set(STATE_COOKIE, state, cookieOptions)

  return NextResponse.redirect(buildAuthorizeUrl(state, challenge))
}
