# Eigensu Billing — Backend Reference

> **⚠️ MIGRATION NOTE (2026-07):** This document predates the migration off
> Supabase. The stack is now **Railway Postgres + NextAuth v5 (credentials,
> JWT sessions) + Cloudinary** (logo storage). References to Supabase
> Auth/Storage below are historical — see `MIGRATION_NOTES.md` for what
> changed.


This document covers the complete backend: database schema, how Supabase is used, the auth system, every server action, both API routes, and the daily cron automation. Read this before touching any backend code.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Supabase — Three Separate Jobs](#2-supabase--three-separate-jobs)
3. [Database Schema](#3-database-schema)
4. [Auth System](#4-auth-system)
5. [Role & Permission System](#5-role--permission-system)
6. [Server Actions](#6-server-actions)
7. [API Routes](#7-api-routes)
8. [Cron Automation](#8-cron-automation)
9. [Audit Log](#9-audit-log)
10. [Email Package](#10-email-package)
11. [How Everything Connects — Request Flow](#11-how-everything-connects--request-flow)

---

## 1. Architecture Overview

```
Browser / Vercel Edge
       │
       ▼
  middleware.ts          ← Supabase Auth cookie refresh + auth gate
       │
       ▼
 Next.js App Router
  ├── Server Components  ← reads DB directly via Drizzle, no REST layer
  ├── Server Actions     ← mutations (createClient, recordPayment, etc.)
  └── API Routes         ← /api/cron/daily  +  /api/invoices/[id]/pdf
       │
       ▼
  Drizzle ORM  ──►  PostgreSQL (hosted on Supabase or Neon or Railway)
       │
  @eigensu/db (packages/db)
       ├── schema.ts     ← all tables and enums
       ├── client.ts     ← lazy singleton DB connection
       └── seed.ts       ← founder users, default settings, reminder rules
```

**Key rule:** There is no REST API between the app and the database. The Next.js server components and server actions talk to Postgres directly via Drizzle. The browser never touches the database — it calls server actions (React 19 / Next.js Server Actions) which run on the server.

---

## 2. Supabase — Three Separate Jobs

Supabase is used for three completely independent things. They could each be replaced separately.

### 2a. PostgreSQL Database

Supabase hosts a standard PostgreSQL 15 instance. The app connects to it using a standard `postgresql://` connection string, exactly the same way it would connect to Neon, Railway, or any other Postgres host. Drizzle ORM handles all queries — **no Supabase client library is involved in database access**.

```
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

The Drizzle client (`packages/db/src/client.ts`) connects once (lazy singleton) and reuses the connection across requests.

**Can swap to:** Neon, Railway, Render Postgres, self-hosted — just change `DATABASE_URL`.

---

### 2b. Auth (Supabase Auth)

Supabase Auth handles login, sessions, password resets, and user invitations. This is the part most tightly integrated into the codebase.

**How it works end to end:**

```
User enters email + password at /login
         │
         ▼
LoginForm calls signIn() server action
         │
         ▼
supabase.auth.signInWithPassword({ email, password })
         │
         ▼
Supabase Auth validates credentials
Returns: access_token + refresh_token
         │
         ▼
@supabase/ssr writes tokens into HTTP-only cookies
(sb-access-token, sb-refresh-token)
         │
         ▼
Every subsequent request goes through middleware.ts
middleware calls supabase.auth.getUser() to validate the cookie
If invalid/expired → redirect to /login
If valid → request continues to the route
         │
         ▼
Server components/actions call getSession()
getSession() calls supabase.auth.getUser() to get the Supabase UID
Then looks up the user in our own `users` table in Postgres
Returns: { authUid: string, user: User }
```

**Files involved:**

| File | Role |
|---|---|
| `apps/web/middleware.ts` | Runs on every request (Edge Runtime). Validates session cookie. Redirects unauthenticated users to `/login`. Also refreshes expired tokens automatically. |
| `apps/web/lib/supabase/server.ts` | Two factory functions: `createSupabaseServerClient()` for regular users (anon key, cookie-based) and `createSupabaseAdminClient()` for admin operations (service role key, no cookies). |
| `apps/web/lib/supabase/client.ts` | Browser-side Supabase client for login form. |
| `apps/web/lib/auth/session.ts` | `getSession()` and `requireSession()` — validates Supabase token then loads the user row from our Postgres `users` table. |
| `apps/web/lib/auth/link-user.ts` | `linkUserOnFirstLogin()` — runs on first login to connect the Supabase auth UID to the pre-seeded `users` row that has a placeholder UUID. |
| `apps/web/lib/actions/auth.ts` | `signIn()` and `signOut()` server actions called from the login form. |

**The two Supabase clients explained:**

```typescript
// Used everywhere for regular user requests
// Reads auth token from cookies, runs as the logged-in user
createSupabaseServerClient()  // uses NEXT_PUBLIC_SUPABASE_ANON_KEY

// Used only for admin operations: inviting users, deleting users
// Bypasses Row Level Security, has full DB access
// Only used in admin.ts actions: inviteUser(), revokeUser()
createSupabaseAdminClient()   // uses SUPABASE_SERVICE_ROLE_KEY
```

**First-login UID linking:** When the seed runs, it inserts founder rows into the `users` table with a `crypto.randomUUID()` placeholder as the `id`. When a founder logs in for the first time, Supabase Auth creates a real auth user with a real UUID. `linkUserOnFirstLogin()` finds the `users` row by email and updates its `id` to match the real Supabase auth UUID. After this, `getSession()` can find the user normally.

**Can swap to:** Clerk, NextAuth.js, Better Auth — but requires rewriting `middleware.ts`, `session.ts`, `link-user.ts`, `supabase/server.ts`, and the auth actions.

---

### 2c. Storage (Supabase Storage)

Supabase Storage is configured for two buckets:

| Bucket | Visibility | Purpose |
|---|---|---|
| `invoices` | Private | Stores generated PDF files (one per invoice) |
| `branding` | Public | Company logo uploads |

**Current status:** PDFs are not yet stored on creation — they render on-demand every time `/api/invoices/[id]/pdf` is called. The `invoices.pdfPath` column exists in the schema for future use. When `pdfPath` is set, the PDF route redirects to a 60-second signed URL from Supabase Storage instead of regenerating.

**Can swap to:** AWS S3, Cloudflare R2, or skip entirely (keep on-demand rendering).

---

## 3. Database Schema

All 13 tables. Drizzle schema file: `packages/db/src/schema.ts`.

### Enums

```sql
project_type:         consulting, product, retainer, other
payment_model:        one_time, installments, subscription, upfront_amc
schedule_item_type:   one_time, installment, amc, subscription
schedule_item_status: pending, invoiced, paid, cancelled
invoice_status:       draft, sent, partial, paid, overdue, cancelled
payment_mode:         bank, upi, cash, other
reminder_type:        client_due_soon, client_due, client_overdue, internal_alert
reminder_status:      pending, sent, failed, skipped
user_role:            admin, accountant, viewer
```

---

### `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `name` | text NOT NULL | |
| `contact_person` | text | nullable |
| `phone` | text | nullable |
| `email` | text NOT NULL | |
| `billing_address` | text | nullable |
| `gst_id` | text | nullable |
| `notes` | text | nullable |
| `status` | text | `'active'` or `'archived'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `client_id` | UUID FK → clients | |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `type` | project_type | |
| `payment_model` | payment_model NOT NULL | drives schedule generation |
| `total_value` | numeric NOT NULL | in whole rupees |
| `start_date` | date NOT NULL | |
| `end_date` | date | nullable |
| `amc_amount` | numeric | for upfront_amc model |
| `amc_recurrence` | text | `monthly`, `quarterly`, `yearly` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `schedule_items`

One row per payment milestone. Generated by `buildSchedule()` in `@eigensu/core` when a project is created.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `project_id` | UUID FK → projects | |
| `type` | schedule_item_type | `one_time`, `installment`, `amc`, `subscription` |
| `label` | text NOT NULL | shown as invoice line item description |
| `amount` | numeric NOT NULL | whole rupees |
| `due_date` | date NOT NULL | when this payment is due |
| `recurrence` | text | `monthly`, `quarterly`, `yearly` — for AMC/subscription |
| `status` | schedule_item_status | starts as `pending` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `invoice_number` | text NOT NULL UNIQUE | format from settings, e.g. `0001/26` |
| `client_id` | UUID FK → clients | |
| `project_id` | UUID FK → projects | nullable (manual invoice has no project) |
| `bank_account_id` | UUID FK → bank_accounts NOT NULL | |
| `issue_date` | date NOT NULL | |
| `due_date` | date NOT NULL | |
| `subtotal` | numeric NOT NULL | pre-tax |
| `tax` | numeric NOT NULL | |
| `total` | numeric NOT NULL | whole rupees only |
| `amount_in_words` | text NOT NULL | e.g. "Fifty Thousand Rupees Only" |
| `status` | invoice_status | `draft` → `sent` → `partial`/`paid`/`overdue` |
| `pdf_path` | text | Supabase Storage path (null = render on demand) |
| `sent_at` | timestamptz | last time the invoice email was sent |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Status transitions:**
```
draft ──► sent ──► partial ──► paid
              └──► overdue ──► paid
draft ──► cancelled  (only draft can be cancelled)
```

---

### `invoice_line_items`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `invoice_id` | UUID FK → invoices (cascade delete) | |
| `description` | text NOT NULL | |
| `amount` | numeric NOT NULL | whole rupees |
| `sort_order` | integer | display order |
| `created_at` | timestamptz | |

---

### `invoice_schedule_items`

Join table. Prevents the same schedule item from appearing in two invoices (unique constraint on `schedule_item_id`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `invoice_id` | UUID FK → invoices (cascade delete) | |
| `schedule_item_id` | UUID FK → schedule_items UNIQUE | one schedule item → one invoice only |

---

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `invoice_id` | UUID FK → invoices | |
| `amount` | numeric NOT NULL | whole rupees |
| `date_received` | date NOT NULL | |
| `mode` | payment_mode | `bank`, `upi`, `cash`, `other` |
| `reference` | text | transaction ID / cheque number |
| `notes` | text | nullable |
| `created_at` | timestamptz | |

**Payment recording logic (`recordPayment` action):**
- Sums all existing payments + new payment
- If total ≥ invoice total → status becomes `paid`; linked `schedule_items` → `paid`
- If total > 0 but < invoice total → status becomes `partial`
- If new total would exceed invoice total → rejected with error

---

### `bank_accounts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `holder_name` | text NOT NULL | |
| `account_number` | text NOT NULL | displayed as `****last4` in UI |
| `ifsc` | text NOT NULL | 11 characters |
| `upi_id` | text | nullable |
| `label` | text NOT NULL | e.g. "HDFC Current" |
| `is_default` | boolean | only one can be true at a time (enforced by transaction) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

The default bank account is used by the cron when auto-generating recurring invoices.

---

### `reminder_rules`

Configured once (via seed), edited via Admin → Reminder Rules.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `type` | reminder_type | `client_due_soon`, `client_due`, `client_overdue`, `internal_alert` |
| `offset_days` | integer | negative = before due date, positive = after |
| `enabled` | boolean | |
| `subject` | text | email subject, supports `{{varName}}` |
| `body_template` | text | email body, supports `{{varName}}` |
| `cc_founders` | boolean | whether to CC the founder emails from settings |
| `sort_order` | integer | display order in admin UI |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Template variables:** `clientName`, `invoiceNumber`, `amount`, `outstanding`, `dueDate`, `daysUntilDue`, `daysOverdue`, `companyName`, `companyEmail`, `companyPhone`

---

### `reminders`

One row per (invoice, rule) combination. Unique constraint prevents duplicate sends.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `rule_id` | UUID FK → reminder_rules (restrict delete) | |
| `type` | reminder_type | copied from rule at time of send |
| `invoice_id` | UUID FK → invoices (cascade delete) | |
| `scheduled_for` | date NOT NULL | the date this was supposed to fire |
| `sent_at` | timestamptz | null until actually sent |
| `status` | reminder_status | `pending` → `sent` or `failed` |
| `recipients` | text[] | email addresses the reminder was sent to |
| `retry_count` | integer | stops retrying after 3 failures |
| `error` | text | last error message if failed |
| `created_at` | timestamptz | |

**Dedup key:** `UNIQUE(invoice_id, rule_id)` — the cron uses `onConflictDoNothing()` when inserting reminders, so the same (invoice, rule) combination never fires twice regardless of how many times the cron runs.

---

### `settings`

Single row. Created by the seed script.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `company_name` | text NOT NULL | |
| `address` | text NOT NULL | |
| `phone` | text NOT NULL | |
| `email` | text NOT NULL | billing contact email |
| `logo_url` | text | nullable |
| `default_tax_percent` | numeric(5,2) | e.g. `18.00` |
| `default_currency` | text | default `INR` |
| `invoice_number_format` | text | e.g. `XXXX/YY` — see invoice numbering |
| `default_due_days` | integer | days after issue date → due date |
| `declaration_text` | text NOT NULL | printed at bottom of PDF |
| `founder_emails` | text[] | CC'd on `ccFounders=true` reminders |
| `auto_send_recurring` | boolean | if true, cron auto-sends generated invoices |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `users`

One row per person who has (or had) access.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | **must match Supabase Auth user UUID** |
| `email` | text NOT NULL UNIQUE | |
| `name` | text NOT NULL | |
| `role` | user_role | `admin`, `accountant`, or `viewer` |

No timestamps — the authoritative source for auth events is Supabase Auth's own tables.

---

### `audit_log`

Append-only. Written by every mutation. `userId = null` for cron operations.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto |
| `user_id` | UUID | nullable — null means cron/system |
| `action` | text NOT NULL | e.g. `CREATE_INVOICE`, `SEND_INVOICE`, `CRON_RUN` |
| `entity_type` | text | nullable — e.g. `invoice`, `client`, `user` |
| `entity_id` | UUID | nullable |
| `meta` | jsonb | arbitrary context (amounts, email addresses, error messages) |
| `created_at` | timestamptz | |

---

### Table Relationships (summary)

```
clients ──< projects ──< schedule_items
        │                     │
        └──< invoices >────────┘  (via invoice_schedule_items join)
                │
                ├──< invoice_line_items
                ├──< payments
                └──< reminders >── reminder_rules

settings           (singleton — one row)
users              (one row per person)
bank_accounts      (one is_default = true)
audit_log          (append-only)
```

---

## 4. Auth System

### Layer 1 — Middleware (Edge Runtime)

`apps/web/middleware.ts` runs before every request, on Vercel's edge network (not Node.js).

- Creates a Supabase client that can read/write cookies
- Calls `supabase.auth.getUser()` to validate the session cookie
- **Public paths** (no auth required): `/login`, `/api/cron/*`
- If no valid session → redirect to `/login`
- If valid session → refresh the access token cookie if needed, pass through

The middleware only checks **authentication** (are you logged in?), not **authorization** (what can you do?). Role checks happen in server actions and admin layout.

### Layer 2 — Session (Node.js / Server)

`apps/web/lib/auth/session.ts`

```typescript
getSession()     // returns Session | null
requireSession() // returns Session or redirects to /login
```

`Session` shape:
```typescript
{
  authUid: string  // Supabase auth UUID
  user: User       // row from our `users` table in Postgres
}
```

This is what every server component and action uses. The `user.role` field drives all authorization decisions.

### Layer 3 — withAuth wrapper

`apps/web/lib/auth/with-auth.ts`

Every server action uses `withAuth(permission, handler)`:

```typescript
export async function createInvoice(input: unknown) {
  return withAuth('invoices:write', async (session) => {
    // session is typed, role has been verified
    // if not authorized → returns { success: false, error: 'Forbidden' }
    ...
  })
}
```

`withAuth` calls `requireSession()`, then `requireRole()`, and if both pass, calls the handler with the session. If either fails, it returns a standardized `{ success: false, error: string }` without throwing.

---

## 5. Role & Permission System

Three roles. All defined in `apps/web/lib/auth/roles.ts`.

| Permission | admin | accountant | viewer |
|---|:---:|:---:|:---:|
| `clients:write` | ✓ | ✓ | |
| `projects:write` | ✓ | ✓ | |
| `invoices:write` | ✓ | ✓ | |
| `payments:write` | ✓ | ✓ | |
| `settings:write` | ✓ | | |
| `users:write` | ✓ | | |
| `bank-accounts:write` | ✓ | | |
| `reminder-rules:write` | ✓ | | |

**Viewers** can read everything (no mutations). They cannot access `/admin` routes (blocked at layout level: `isAdmin(session) → redirect`).

**Self-protection rules** (double-layered — enforced at both action and UI level):
- `updateUserRole()` → blocked if `userId === session.authUid`
- `revokeUser()` → blocked if `userId === session.authUid`

---

## 6. Server Actions

All in `apps/web/lib/actions/`. All return `{ success: true, data? }` or `{ success: false, error: string }`. They never throw to the client.

### clients.ts

| Action | Permission | What it does |
|---|---|---|
| `createClient(input)` | `clients:write` | Validates with Zod, inserts into `clients`, writes audit log |
| `updateClient(id, input)` | `clients:write` | Partial update, `updatedAt` bumped |
| `archiveClient(id)` | `clients:write` | Sets `status = 'archived'` |

### projects.ts

| Action | Permission | What it does |
|---|---|---|
| `createProject(input)` | `projects:write` | Calls `buildSchedule()` from `@eigensu/core` (pure computation), then wraps project insert + schedule_items insert in a **single transaction** so they never get out of sync |
| `updateProject(id, input)` | `projects:write` | Updates project metadata; if payment model or amounts change, deletes pending/cancelled schedule items and regenerates from scratch |

**Payment models and what `buildSchedule()` generates:**

| Model | Schedule items created |
|---|---|
| `one_time` | 1 item of type `one_time` |
| `installments` | N items of type `installment` (you define each one) |
| `subscription` | One item per recurrence period from `startDate` to `endDate` |
| `upfront_amc` | 1 `one_time` upfront item + recurring `amc` items |

### invoices.ts

| Action | Permission | What it does |
|---|---|---|
| `createInvoice(input)` | `invoices:write` | Validates amounts (must be whole rupees), calls `allocateInvoiceNumber()` (atomic sequence), inserts invoice + line items + schedule item links |
| `sendInvoice(invoiceId)` | `invoices:write` | Renders PDF (non-fatal), sends email via Resend, flips status `draft→sent` (re-sends on sent/partial/overdue only update `sentAt`), inserts a `reminders` row for the due-date rule |
| `cancelInvoice(invoiceId)` | `invoices:write` | Only works on `draft` status — filtered at DB level |
| `getInvoiceOutstanding(invoiceId)` | none (no auth) | Returns `total - sum(payments)` for internal use |

**Invoice number allocation** (`apps/web/lib/invoice-number.ts`):
Uses a Postgres sequence (`invoice_seq`) with `SELECT nextval('invoice_seq')` for atomic, duplicate-free numbering even under concurrent creates. The format is configured in settings (e.g. `XXXX/YY` → `0001/26`).

### payments.ts

| Action | Permission | What it does |
|---|---|---|
| `recordPayment(input)` | `payments:write` | Validates amount doesn't exceed outstanding, inserts payment row, updates invoice status (`partial` / `paid`), if `paid` → marks all linked `schedule_items` as `paid` |

### admin.ts

| Action | Permission | What it does |
|---|---|---|
| `updateSettings(input)` | `settings:write` | Updates the singleton `settings` row |
| `uploadLogo(logoUrl)` | `settings:write` | Updates `logoUrl` field only |
| `upsertBankAccount(input)` | `bank-accounts:write` | Insert or update; if `isDefault=true`, atomically clears other defaults first |
| `setDefaultBankAccount(id)` | `bank-accounts:write` | **Wrapped in `db.transaction()`** — clears all defaults then sets the new one atomically |
| `deleteBankAccount(id)` | `bank-accounts:write` | Checks FK constraint first (is any invoice using it?), returns user-friendly error if so |
| `upsertReminderRule(input)` | `reminder-rules:write` | Updates existing rule only (no new types can be created without a `type` enum) |
| `inviteUser(input)` | `users:write` | Calls `supabase.auth.admin.inviteUserByEmail()` (service role), inserts placeholder row in `users` table, links on first login |
| `updateUserRole(userId, role)` | `users:write` | Guards against self-change |
| `revokeUser(userId)` | `users:write` | Guards against self-revoke; calls `supabase.auth.admin.deleteUser()` then deletes from `users` |
| `sendTestEmail()` | `settings:write` | Sends a test email to the logged-in admin's address via `sendAlertEmail()` |

---

## 7. API Routes

Only two API routes exist. Everything else is server actions.

### POST `/api/cron/daily`

`apps/web/app/api/cron/daily/route.ts`

Triggered by Vercel Cron at 08:30 IST daily (configured in `vercel.json`: `"schedule": "0 3 * * *"` — 03:00 UTC = 08:30 IST).

**Authentication:** `Authorization: Bearer <CRON_SECRET>` header. Returns 401 if missing or wrong.

**Response:**
```json
{
  "ok": true,
  "summary": {
    "generatedInvoices": 2,
    "overdueFlagged": 1,
    "remindersSent": 3,
    "remindersSkipped": 0,
    "remindersFailed": 0,
    "alertsSent": 1,
    "todayIST": "2026-06-21",
    "errors": []
  }
}
```

**To test locally:**
```bash
curl -X POST http://localhost:3000/api/cron/daily \
  -H "Authorization: Bearer your_cron_secret"
```

---

### GET `/api/invoices/[id]/pdf`

`apps/web/app/api/invoices/[id]/pdf/route.ts`

**Authentication:** Requires a valid Supabase session cookie (any role).

**Flow:**
1. Verify session cookie
2. Look up invoice in DB with client, line items, bank account
3. If `invoice.pdfPath` is set → redirect to a 60-second Supabase Storage signed URL
4. If `pdfPath` is null → render PDF on demand via `renderInvoicePDF()` and stream it as `application/pdf`

This is the URL used by the "Download PDF" button in the invoice detail page and also by the email attachment logic.

---

## 8. Cron Automation

All in `apps/web/lib/automation/`. Entry point: `run.ts` → `runDailyCron()`.

Three steps run independently — failure in one step does **not** abort the others. All errors are collected in `summary.errors[]` and written to the audit log.

### Step 1 — Generate Recurring Invoices

`generate-recurring.ts` → `generateRecurringInvoices(todayIST)`

Finds all `schedule_items` where:
- `type IN ('amc', 'subscription')`
- `status = 'pending'`
- `due_date ≤ today (IST)`
- No existing `invoice_schedule_items` row links them to an invoice

For each qualifying item (capped at 50 per run):
- Computes subtotal, tax, total
- Allocates an invoice number
- Inserts `invoice` row (status: `draft` or `sent` based on `autoSendRecurring`)
- Inserts one `invoice_line_items` row
- Inserts `invoice_schedule_items` link
- If `autoSendRecurring = true`: fetches full invoice with relations, renders PDF (non-fatal), sends email via Resend

The 50-item cap prevents timeouts on the first run after a long gap.

### Step 2 — Mark Overdue

`mark-overdue.ts` → `markOverdue(todayIST)`

Updates invoices where:
- `status IN ('sent', 'partial')`
- `due_date < today (IST)`

Sets them to `status = 'overdue'`. Returns count of updated rows.

### Step 3 — Send Reminders

`send-reminders.ts` → `sendDueReminders(todayIST)`

For each enabled `reminder_rules` row:
1. Finds all invoices where the rule's fire date matches today based on `offset_days`:
   - Negative offset (e.g. `-3`): fires 3 days before `due_date` → invoice due on `today + 3`
   - Zero: fires on due date
   - Positive (e.g. `+7`): fires 7 days after due date → invoice was due `today - 7`
2. Checks `reminders` table for `(invoice_id, rule_id)` — skips if already sent (the unique constraint + `onConflictDoNothing` is the dedup mechanism, not application logic)
3. For `client_*` rules: sends `sendReminderEmail()` to the client. If `ccFounders = true`, adds founder emails to CC.
4. For `internal_alert` rules: sends `sendAlertEmail()` to founders only (no client CC)
5. After sending: inserts a `reminders` row with `status = 'sent'` (or `'failed'` if the send threw)
6. On failure: increments `retry_count`. Stops retrying after 3 attempts (`retryCount >= 3` → status `'failed'`, no more retries)

### IST Timezone

`today-ist.ts` computes "today" in IST regardless of what timezone the server is in:

```typescript
getTodayIST()  // → Date (midnight IST)
dateToISO()    // → 'YYYY-MM-DD' string in IST
```

Uses `date-fns-tz` under the hood (`toZonedTime` + `startOfDay`).

---

## 9. Audit Log

`apps/web/lib/audit.ts` → `writeAuditLog(userId, action, entityType?, entityId?, meta?)`

Every mutation writes an audit log entry. `userId = null` for cron operations.

**All action strings in use:**

| Action | Who | Entity |
|---|---|---|
| `CREATE_CLIENT` | user | `client` |
| `UPDATE_CLIENT` | user | `client` |
| `ARCHIVE_CLIENT` | user | `client` |
| `CREATE_PROJECT` | user | `project` |
| `UPDATE_PROJECT` | user | `project` |
| `CREATE_INVOICE` | user | `invoice` |
| `SEND_INVOICE` | user | `invoice` |
| `CANCEL_INVOICE` | user | `invoice` |
| `RECORD_PAYMENT` | user | `payment` |
| `UPDATE_SETTINGS` | user | `settings` |
| `UPLOAD_LOGO` | user | `settings` |
| `CREATE_BANK_ACCOUNT` | user | `bank_account` |
| `UPDATE_BANK_ACCOUNT` | user | `bank_account` |
| `SET_DEFAULT_BANK_ACCOUNT` | user | `bank_account` |
| `DELETE_BANK_ACCOUNT` | user | `bank_account` |
| `UPDATE_REMINDER_RULE` | user | `reminder_rule` |
| `INVITE_USER` | user | `user` |
| `UPDATE_USER_ROLE` | user | `user` |
| `REVOKE_USER` | user | `user` |
| `CRON_GENERATE_ERROR` | system | `schedule_item` |
| `CRON_RUN` | system | — |

Viewable at `/admin/audit-log` with date, entity type, and action filters.

---

## 10. Email Package

`packages/email/src/sender.ts`

Three send functions, all using the Resend SDK:

```typescript
sendInvoiceEmail(params)   // sends the invoice to the client with optional PDF attachment
sendReminderEmail(params)  // sends a reminder (DB-driven template via interpolate())
sendAlertEmail(params)     // sends an internal alert to founders
```

**Config:**
- `RESEND_API_KEY` — Resend API key
- `EMAIL_FROM` — sender address (must be a verified domain in Resend)

**Template interpolation:** `sendReminderEmail` pulls `subject` and `bodyTemplate` from the `reminder_rules` row and replaces `{{varName}}` placeholders at send time. This means you can change reminder wording in the admin UI without code changes.

**PDF attachment:** `sendInvoiceEmail` accepts an optional `pdfBuffer: Buffer`. If provided, it's attached as `invoice-{number}.pdf`. Both `sendInvoice` action and the cron auto-send path attempt to render the PDF first, but treat failure as non-fatal — the email goes out without attachment rather than failing entirely.

**₹ vs Rs. — important rendering rule:**
- `formatINR()` from `@eigensu/core` returns `₹` (U+20B9) — used in HTML emails and the web UI
- PDF documents (`InvoiceDocument.tsx`) use `rs()` helper which converts `₹ → Rs.` — because Helvetica (the PDF font) cannot encode U+20B9
- These two paths must **never be swapped**

---

## 11. How Everything Connects — Request Flow

### Example: User records a payment

```
1. User clicks "Record Payment" on invoice detail page
2. RecordPaymentDialog (client component) calls recordPayment(input) server action

3. recordPayment() runs on the server:
   a. withAuth('payments:write') →
      - createSupabaseServerClient() reads cookie
      - supabase.auth.getUser() validates token
      - getSession() loads user row from Postgres users table
      - hasPermission(session, 'payments:write') → admin/accountant only
   b. Zod validates input
   c. Loads invoice with payments from DB
   d. Checks: not cancelled, not already paid, amount doesn't exceed outstanding
   e. Inserts payment row
   f. Updates invoice status (partial or paid)
   g. If paid: marks linked schedule_items as paid
   h. Writes audit log
   i. Returns { success: true, data: { payment, newInvoiceStatus, outstanding } }

4. Dialog shows toast (success or error)
5. router.refresh() triggers Next.js to re-fetch the server component
6. Invoice detail page re-renders with updated status and payment list
```

### Example: Cron fires at 08:30 IST

```
1. Vercel Cron POSTs to /api/cron/daily with Authorization header
2. Route validates CRON_SECRET
3. runDailyCron() runs three independent steps (each in try/catch):
   a. generateRecurringInvoices() — creates invoices for due AMC/subscription items
   b. markOverdue() — flips sent/partial invoices past due date to overdue
   c. sendDueReminders() — sends emails for each enabled reminder rule
4. Audit log entry written with full summary
5. Response: { ok: true, summary: { ... } }
```

### Example: User logs in for the first time (founder)

```
1. Founder opens /login, enters email + password
2. LoginForm calls signIn() server action
3. supabase.auth.signInWithPassword() → Supabase Auth validates credentials
4. @supabase/ssr writes access_token + refresh_token into HTTP-only cookies
5. redirect('/dashboard')

6. Dashboard page server component calls requireSession()
7. requireSession() → getSession():
   a. createSupabaseServerClient() reads cookies
   b. supabase.auth.getUser() → returns authUser (Supabase UID)
   c. db.query.users.findFirst({ where: eq(users.id, authUser.id) }) → null (placeholder UUID mismatch)
   d. linkUserOnFirstLogin(authUser.id, authUser.email):
      - finds the seeded `users` row by email
      - updates its id to match the real Supabase auth UUID
   e. re-queries users table → now finds the row
   f. returns Session { authUid, user }

8. Dashboard renders with correct session and role
```
