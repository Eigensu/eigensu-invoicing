import { randomBytes, createHash } from 'node:crypto'
import {
  CANVA_AUTHORIZE_URL,
  CANVA_TOKEN_URL,
  CANVA_OAUTH_SCOPES,
  getCanvaClientId,
  getCanvaClientSecret,
  getCanvaRedirectUri,
} from './config'

export interface CanvaTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const url = new URL(CANVA_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', getCanvaClientId())
  url.searchParams.set('redirect_uri', getCanvaRedirectUri())
  url.searchParams.set('scope', CANVA_OAUTH_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

function basicAuthHeader(): string {
  return Buffer.from(`${getCanvaClientId()}:${getCanvaClientSecret()}`).toString('base64')
}

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
): Promise<CanvaTokenResponse> {
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: getCanvaRedirectUri(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Canva token exchange failed (${res.status}): ${await res.text()}`)
  }
  return res.json() as Promise<CanvaTokenResponse>
}

export async function refreshTokens(refreshToken: string): Promise<CanvaTokenResponse> {
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    throw new Error(`Canva token refresh failed (${res.status}): ${await res.text()}`)
  }
  return res.json() as Promise<CanvaTokenResponse>
}
