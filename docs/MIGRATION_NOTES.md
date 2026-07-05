# Migration Notes — Supabase → Railway + NextAuth + Cloudinary

**Date:** 2026-07-04
**Branch:** `claude/migrate-off-supabase-1fxrol`

The repo no longer references Supabase anywhere in code, config, dependencies,
or the lockfile. Auth is NextAuth v5 (credentials + JWT sessions), the database
is Railway Postgres via the existing Drizzle setup, and company-logo upload
goes to Cloudinary. All data is rebuilt from scratch — nothing was preserved,
per the clean-slate decision.

---

## What changed, per phase

### Phase 1 — Dependencies
- `apps/web`: removed `@supabase/ssr`, `@supabase/supabase-js`; added
  `next-auth@5.0.0-beta.31`, `bcryptjs`, `cloudinary` (+ `@types/bcryptjs` dev).
- `packages/db`: added `bcryptjs` (dev) for the seed's optional
  `SEED_FOUNDER_PASSWORD` path. No Supabase dependency existed there.

### Phase 2 — Schema
New `users` columns (migration `0001_chief_franklin_storm.sql`):
- `password_hash text` — nullable; null = invited, password not yet set
- `invite_token text` — nullable, unique
- `invite_token_expires_at timestamptz` — nullable
- `is_active boolean not null default true` — soft-revoke flag

### Phase 3 — NextAuth v5 core
- `apps/web/auth.config.ts` — edge-safe config (JWT strategy, `/login` sign-in
  page, jwt/session callbacks). Split out so the middleware doesn't bundle
  Drizzle/`postgres` into the Edge runtime.
- `apps/web/auth.ts` — full NextAuth instance with the single Credentials
  provider: lowercased-email lookup via Drizzle, rejects users with no
  `passwordHash` or `isActive=false`, verifies with `bcryptjs.compare`.
  No database adapter — the Drizzle `users` table is the sole source of truth.
- `apps/web/app/api/auth/[...nextauth]/route.ts` — `GET`/`POST` handlers.
- `middleware.ts` — NextAuth `auth()` wrapper; same matcher; public paths are
  `/login`, `/api/auth`, `/api/cron`, `/set-password`; authenticated users
  hitting `/login` are redirected to `/`.
- `lib/actions/auth.ts` and `lib/auth/session.ts` rewritten. The session shape
  `{ authUid, user }` is unchanged, so `roles.ts`, `with-auth.ts`, and all
  ~47 `@eigensu/db` consumers compile untouched. `getSession()` additionally
  returns null for inactive users, so revocation kills live sessions.
- Deleted: `lib/supabase/server.ts`, `lib/supabase/client.ts`,
  `lib/auth/link-user.ts` (first-login UID-link logic removed, not ported).
- `apps/web/tsconfig.json`: `declaration`/`declarationMap` disabled (app never
  emits declarations; the inherited library setting broke type-checking of
  NextAuth's inferred types under pnpm — TS2742).

### Phase 4 — Invite / revoke / set-password / seed
- `inviteUser`: creates the `users` row directly (`passwordHash: null`,
  `inviteToken = crypto.randomUUID()`, 7-day expiry) and emails a
  `/set-password?token=…` link via the existing `@eigensu/email` Resend
  sender. Duplicate email → clean error. Role checks and audit logs kept.
- `revokeUser`: soft revoke (`isActive=false`, invite token cleared).
  `audit_log.userId` references stay valid forever. Self-revocation still
  blocked. Admin → Users badges revoked users ("Revoked") and hides their
  row actions.
- New `/set-password` page + server action: validates token existence,
  expiry, and active status; Zod min-8 password; `bcrypt.hash(password, 12)`;
  clears the token (single-use); redirects to `/login`. Invalid/expired/reused
  tokens all get the same generic error — no user enumeration.
- `packages/db/seed.ts` rewritten and **idempotent** (see below).

### Phase 5 — Cloudinary
- `apps/web/lib/cloudinary.ts` — server-only SDK config from env.
- `uploadLogo` server action now takes a `FormData` file: validates
  image type and ≤ 2 MB, uploads to folder `eigensu-billing/branding` with
  fixed `public_id: company-logo` + `overwrite: true` (old logos never
  accumulate), stores `secure_url` in `settings.logoUrl`.
- Settings form: "Logo URL" text input replaced by a file input
  (accept `image/*`, client-side 2 MB check) with a current-logo preview.
- **Bug fix:** `packages/invoice/src/InvoiceDocument.tsx` now renders
  `company.logoUrl` — `<Image>` in the header right side, 40 pt tall, only
  when `logoUrl` is truthy. (Only change in `packages/invoice`.)

### Phase 6 — PDF route
- `app/api/invoices/[id]/pdf/route.ts`: the `invoice.pdfPath` Supabase
  signed-URL branch is deleted; the route always renders on demand via
  `renderInvoicePDF`. The `pdfPath` column stays in the schema (out of scope).

### Phase 7 — Cleanup
- `.env.example` updated (see env list below); README, DEPLOY.md, and
  USER_GUIDE.md rewritten for the new stack; TECH_SPEC.md / BACKEND.md /
  IMPLEMENTATION_SPEC.md are historical design documents and carry a
  migration banner instead of a rewrite.
- `grep -ri supabase` across code, config, package.json files, and the
  lockfile returns zero hits.

---

## Environment variables

Removed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_INVOICES_BUCKET`, `SUPABASE_BRANDING_BUCKET`.

Current full set (`.env.example`):

| Var | Notes |
|---|---|
| `DATABASE_URL` | Railway Postgres public URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | logo uploads |
| `RESEND_API_KEY`, `EMAIL_FROM` | unchanged |
| `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`, `SEED_DEMO` | unchanged |
| `SEED_FOUNDER_PASSWORD` | optional — seed founder passwords directly |
| `AUTH_TRUST_HOST=true` | only if deploying somewhere other than Vercel |

---

## Seed idempotency guarantee

`pnpm --filter @eigensu/db seed` can be run any number of times:

- **settings**: inserted only when the table is empty.
- **reminder_rules**: the 5 rules are inserted only when no rules exist.
- **bank_accounts**: the default account is inserted only when none exists
  (placeholder values — edit in Admin → Bank Accounts).
- **users** (founders): skipped when the email already exists
  (`onConflictDoNothing` on the email unique constraint). Without
  `SEED_FOUNDER_PASSWORD`, a set-password URL is printed per new founder.

Verified here by running the seed twice against a from-scratch database:
both runs ended with identical counts — 1 settings, 5 reminder_rules,
1 bank_accounts, 1 users.

> ⚠️ Only **one** founder (`work.eigensu@gmail.com`) is defined in
> `seed.ts` — the second founder's email/name were never specified anywhere
> in the repo, and no values were invented. Add the second founder to the
> `founderData` array before seeding production.

---

## What was verified

All in this sandbox (no Railway/Cloudinary/Resend credentials were available —
see next section):

- `pnpm build`, `pnpm lint`, `pnpm type-check`, `pnpm test` (46 tests) — all
  green on a forced, uncached run.
- From-scratch `db:migrate` against a clean local Postgres 16: all 14 tables
  plus the new `users` columns created.
- Seed run twice: identical counts (see above); `SEED_FOUNDER_PASSWORD` path
  also exercised.
- Live HTTP smoke test against `next dev` + local Postgres:
  - `/dashboard` logged out → 307 to `/login`; `/login` → 200
  - wrong password → `CredentialsSignin` error, no session cookie;
    correct password → session cookie, `/` → `/dashboard` → 200
  - `/login` while authenticated → 307 to `/`
  - `/set-password` is publicly reachable; the action rejects short
    passwords, garbage tokens, expired tokens, and **reused** tokens with the
    same generic message; valid token sets the password and redirects to
    `/login`; the new user can then log in
  - revoke (`is_active=false`): live session immediately locked out of
    protected routes; re-login rejected
  - viewer role: `/admin/*` → 307 to `/dashboard`; admin reaches `/admin/users`
- `renderInvoicePDF` produces a valid PDF with and without a logo; the logo
  image is embedded when `logoUrl` is set.

## What the human must still do

1. **Provide env values** — `.env` / `apps/web/.env.local` did not exist in
   this environment (no `DATABASE_URL`, `AUTH_SECRET`, `CLOUDINARY_*`), so
   nothing was run against Railway. Recreate them locally per `.env.example`.
2. **Wipe and rebuild Railway** (mock data, approved for deletion):
   ```bash
   psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;'
   pnpm --filter @eigensu/db db:migrate
   pnpm --filter @eigensu/db seed   # prints founder set-password URL
   ```
   Note the extra `DROP SCHEMA drizzle` — Drizzle keeps its migration journal
   in a separate `drizzle` schema; dropping only `public` makes `db:migrate`
   a silent no-op (verified empirically).
3. **Add the second founder** to `packages/db/seed.ts` before seeding.
4. **Mirror env changes in Vercel** (remove the 5 Supabase vars; add
   `AUTH_SECRET` + 3 Cloudinary vars), then redeploy.
5. **Manual smoke tests needing real services**: Cloudinary logo upload from
   Admin → Settings (needs real Cloudinary creds), invite-email delivery and
   invoice Send (Resend), and the full client → project → invoice → payments
   flow against Railway (fresh sequence should start at `0001/26`).
6. **Rotate the Railway DB password** that was exposed during setup, and
   update `DATABASE_URL` everywhere.
7. **Decommission the Supabase project** (or let it expire).
