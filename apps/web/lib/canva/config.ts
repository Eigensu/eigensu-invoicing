// One Canva Brand Template (rebuilt with 6 fixed line-item slots as
// individually tagged text fields — Canva's Autofill API cannot target
// cells inside a native Table element) is autofilled for every invoice.
// See apps/web/lib/canva/render-data.ts for the field-label mapping.
//
// There is no dedicated "autofill" OAuth scope — Canva's own REST API
// quickstart for autofill + brand templates lists this exact scope set:
// https://www.canva.dev/docs/apps/quickstart/?app-surface=Canva+for+your+platform
export const CANVA_OAUTH_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
  'asset:read',
  'asset:write',
  'profile:read',
].join(' ')

export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize'
export const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'
export const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

export function getCanvaClientId(): string {
  const id = process.env['CANVA_CLIENT_ID']
  if (!id) throw new Error('CANVA_CLIENT_ID is not set')
  return id
}

export function getCanvaClientSecret(): string {
  const secret = process.env['CANVA_CLIENT_SECRET']
  if (!secret) throw new Error('CANVA_CLIENT_SECRET is not set')
  return secret
}

export function getCanvaRedirectUri(): string {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL']
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set')
  return `${appUrl.replace(/\/$/, '')}/api/canva/callback`
}

// Fallback used only when no brand template id has been saved yet on the
// canva_connection row (e.g. right after a fresh OAuth connect).
export function getDefaultCanvaBrandTemplateId(): string | undefined {
  return process.env['CANVA_BRAND_TEMPLATE_ID']
}
