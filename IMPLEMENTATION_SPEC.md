# Eigensu Billing — Implementation Specification

**Version:** 2.0  
**Date:** 2026-06-19  
**Status:** Awaiting Approval  
**Depends on:** TECH_SPEC.md v2.0

---

## Overview

This document is the step-by-step contract for building Eigensu Billing. It defines exactly what gets built in each phase, what files are created, what the acceptance criteria are, and what "done" means before moving on. No phase begins until the previous one passes `pnpm build`, `pnpm lint`, `pnpm type-check`, and (from Phase 3 onward) `pnpm test` cleanly.

**Total phases: 13**

---

## Phase 0 — Prerequisites & Repo Init

### What we do
- Create the root `eigensu-billing/` directory
- Initialize git
- Create `.gitignore` (node_modules, .env, .turbo, .next, dist, *.local)
- Create `.env` from `.env.example` (founder fills values before running any phase)

### Files created
```
.gitignore
.env.example          # all keys from TECH_SPEC §11
.env                  # not committed — founder fills this
```

### Done when
- Git repo initialized with an initial commit
- `.env.example` matches the keys in TECH_SPEC §11 exactly
- `.env` exists locally with real values (Supabase project created, Resend key obtained)

---

## Phase 1 — Monorepo Scaffold

### What we do
Set up the Turborepo + pnpm monorepo skeleton. Every workspace exists and resolves. No real logic — just correct wiring and config.

### Files created

```
pnpm-workspace.yaml
turbo.json
package.json                          # root, scripts only

packages/config/
  package.json
  tsconfig.base.json
  eslint.config.js
  tailwind.preset.js                  # single source of truth for brand colors

packages/db/
  package.json
  src/
    schema.ts                         # stub (table shells, enums declared)
    client.ts                         # Drizzle + postgres client
    index.ts
  drizzle.config.ts

packages/core/
  package.json
  src/
    schedule-engine.ts                # stub with correct function signatures
    reminder-rules.ts                 # stub
    money.ts                          # stub
    number-to-words.ts                # stub
    invoice-numbering.ts              # stub
    index.ts
  vitest.config.ts

packages/invoice/
  package.json
  src/
    InvoiceDocument.tsx               # stub: empty PDF page
    InvoicePreview.tsx                # stub
    render.ts                         # stub: returns empty Buffer

packages/email/
  package.json
  src/
    templates/
      DueSoon.tsx                     # stub
      DueToday.tsx                    # stub
      Overdue.tsx                     # stub
      InternalAlert.tsx               # stub
    sender.ts                         # stub

packages/ui/
  package.json
  src/
    components/                       # shadcn/ui init output goes here
    theme.ts

apps/web/
  package.json
  next.config.ts
  tailwind.config.ts                  # imports tailwind.preset.js
  tsconfig.json
  app/
    layout.tsx
    page.tsx
  middleware.ts                       # stub (pass-through)
```

### Key config: `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":        { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "lint":         {},
    "type-check":   { "dependsOn": ["^build"] },
    "test":         { "dependsOn": ["^build"] },
    "dev":          { "persistent": true, "dependsOn": ["^build"] },
    "db:generate":  {},
    "db:migrate":   {}
  }
}
```

### Key config: root `package.json` scripts

```json
{
  "scripts": {
    "dev":          "turbo dev",
    "build":        "turbo build",
    "lint":         "turbo lint",
    "type-check":   "turbo type-check",
    "test":         "turbo test",
    "db:generate":  "turbo db:generate",
    "db:migrate":   "turbo db:migrate"
  }
}
```

### Key config: `packages/config/tailwind.preset.js`

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        // IMPORTANT: verify both values against the source invoice PDF before Phase 6
        'eigensu-blue': '#86b9d4',  // brand blue — UI accents, PDF dividers
        'eigensu-bg':   '#d6eaf5',  // light wash — PDF page background
      }
    }
  }
}
```

These are the **only** place these colors are defined. The PDF template imports from this preset.

### Key config: `packages/config/tsconfig.base.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

### Acceptance criteria
- `pnpm install` runs without errors
- `pnpm build` succeeds (stubs may warn, must not error)
- `pnpm lint` runs
- `pnpm test` runs (passes trivially with zero tests)
- All package names resolve: `@eigensu/db`, `@eigensu/core`, `@eigensu/invoice`, `@eigensu/email`, `@eigensu/ui`, `@eigensu/config`
- `pnpm dev` starts Next.js on localhost:3000

---

## Phase 2 — Database (`@eigensu/db`)

### What we do
Implement the complete Drizzle schema from TECH_SPEC §5. Run migrations. Write the seed script.

### Files created/updated

```
packages/db/src/schema.ts           # complete — all tables and enums
packages/db/src/client.ts           # Drizzle + postgres client
packages/db/migrations/             # generated by drizzle-kit
packages/db/seed.ts                 # seed defaults
packages/db/package.json            # scripts: generate, migrate, seed
```

### Complete enum list

```typescript
// schema.ts
export const paymentModelEnum  = pgEnum('payment_model',   ['one_time', 'installments', 'subscription', 'upfront_amc'])
export const scheduleTypeEnum  = pgEnum('schedule_type',   ['one_time', 'installment', 'amc', 'subscription'])
export const scheduleStatusEnum = pgEnum('schedule_status', ['pending', 'partial', 'paid', 'overdue', 'cancelled'])
export const invoiceStatusEnum = pgEnum('invoice_status',  ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'])
export const recurrenceEnum    = pgEnum('recurrence',      ['none', 'monthly', 'quarterly', 'yearly'])
export const reminderTypeEnum  = pgEnum('reminder_type',   ['client_due_soon', 'client_due', 'client_overdue', 'internal_alert'])
export const reminderStatusEnum = pgEnum('reminder_status', ['pending', 'sent', 'failed', 'skipped'])
export const userRoleEnum      = pgEnum('user_role',       ['admin', 'viewer', 'accountant'])
export const clientStatusEnum  = pgEnum('client_status',   ['active', 'archived'])
export const projectStatusEnum = pgEnum('project_status',  ['active', 'completed', 'archived'])
```

### Schema highlights (vs v1)

- `clients.status` → `clientStatusEnum` (was plain text)
- `projects.status` → `projectStatusEnum` (was plain text)
- `scheduleItems`: **no** `generatedInvoiceId` column
- `invoices`: **no** `scheduleItemId` column; `bankAccountId` is NOT NULL
- New: `invoiceSequences (year int PK, lastSeq int DEFAULT 0)`
- New: `invoiceScheduleItems (id uuid, invoiceId FK, scheduleItemId FK UNIQUE)`
- `reminders`: added `ruleId FK → reminderRules NOT NULL`, `retryCount int DEFAULT 0`; `UNIQUE (invoiceId, ruleId)`
- `settings`: added `autoSendRecurring boolean DEFAULT false`

### Seed data (placeholders — fill before running)

```typescript
// settings row
{
  companyName: "Eigensu",
  address: "[COMPANY_ADDRESS]",
  phone: "[COMPANY_PHONE]",
  email: "contact@eigensu.in",
  logoUrl: null,
  defaultTaxPercent: 0,
  defaultCurrency: "INR",
  invoiceNumberFormat: "XXXX/YY",
  defaultDueDays: 30,
  declarationText: "We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.",
  founderEmails: ["[FOUNDER_1_EMAIL]", "[FOUNDER_2_EMAIL]"],
  autoSendRecurring: false,
}

// bankAccount row (default)
{
  holderName: "[ACCOUNT_HOLDER_NAME]",
  accountNumber: "[ACCOUNT_NUMBER]",
  ifsc: "[IFSC_CODE]",
  label: "Primary Account",
  isDefault: true,
}

// reminderRules — 5 rules, sortOrder matches display order
[
  { type: "client_due_soon",  offsetDays: -7,  enabled: true,  ccFounders: false, sortOrder: 1,
    subject: "Reminder: Invoice {{invoiceNumber}} due in {{daysUntilDue}} days",
    bodyTemplate: "Dear {{clientName}}, ..."  },
  { type: "client_due",       offsetDays: 0,   enabled: true,  ccFounders: false, sortOrder: 2,
    subject: "Invoice {{invoiceNumber}} is due today",
    bodyTemplate: "Dear {{clientName}}, ..."  },
  { type: "client_overdue",   offsetDays: 7,   enabled: true,  ccFounders: false, sortOrder: 3,
    subject: "Invoice {{invoiceNumber}} is overdue",
    bodyTemplate: "Dear {{clientName}}, ..."  },
  { type: "client_overdue",   offsetDays: 15,  enabled: true,  ccFounders: true,  sortOrder: 4,
    subject: "Second notice: Invoice {{invoiceNumber}} is overdue",
    bodyTemplate: "Dear {{clientName}}, ..."  },
  { type: "internal_alert",   offsetDays: 30,  enabled: true,  ccFounders: true,  sortOrder: 5,
    subject: "Action required: {{overdueCount}} invoices overdue",
    bodyTemplate: "Hi, there are {{overdueCount}} invoices overdue by 30+ days..."  },
]

// users — seed with placeholder UUIDs; real UIDs linked on first login (see TECH §10)
[
  { id: crypto.randomUUID(), email: "[FOUNDER_1_EMAIL]", name: "[FOUNDER_1_NAME]", role: "admin" },
  { id: crypto.randomUUID(), email: "[FOUNDER_2_EMAIL]", name: "[FOUNDER_2_NAME]", role: "admin" },
]
// Seed also calls supabase.auth.admin.inviteUserByEmail() for each founder email
// so they receive an invitation to set their password.

// demo data — only if process.env.SEED_DEMO === 'true'
// - 1 client: "Binge Consulting"
// - 1 project: "Recruitr", model=installments, three schedule items
//   (amounts as placeholders — fill in seed.ts)
```

### Acceptance criteria
- `pnpm db:generate` produces migration files
- `pnpm db:migrate` applies to Supabase without errors
- `pnpm --filter @eigensu/db seed` inserts seed rows and sends founder invite emails
- All tables visible in Supabase dashboard
- `@eigensu/db` exports typed `$inferSelect` and `$inferInsert` types for every table
- `pnpm build` and `pnpm lint` pass

---

## Phase 3 — Core Domain Logic (`@eigensu/core`)

### What we do
Implement all five engines with full unit tests. This is the most critical phase — all money math and scheduling logic lives here, tested in isolation before any UI is built.

### Files created/updated

```
packages/core/src/
  money.ts
  number-to-words.ts
  invoice-numbering.ts
  schedule-engine.ts
  reminder-rules.ts
  index.ts
  __tests__/
    money.test.ts
    number-to-words.test.ts
    invoice-numbering.test.ts
    schedule-engine.test.ts
    reminder-rules.test.ts
```

### Required test cases

**money.ts**
- `toPaise(125000)` → `12500000`
- `fromPaise(12500000)` → `125000`
- `addAmounts(0.1, 0.2)` → `0.3` (no float drift — goes via paise)
- `subtractAmounts(125000, 50000)` → `75000`
- `computeTax(125000, 18)` → `22500` (whole rupees, rounds down)
- `computeTax(125000, 0)` → `0`
- `formatINR(125000)` → `"₹1,25,000"`
- `formatINR(1000000)` → `"₹10,00,000"`
- `formatINR(10000000)` → `"₹1,00,00,000"`
- `formatINR(0)` → `"₹0"`
- `formatINR(500)` → `"₹500"`

**number-to-words.ts**
- `amountToWords(0)` → `"Zero Only"`
- `amountToWords(500)` → `"Five Hundred Only"` (not "Fife Hundred")
- `amountToWords(1500)` → `"One Thousand Five Hundred Only"`
- `amountToWords(25000)` → `"Twenty Five Thousand Only"` (not "Fife" anywhere)
- `amountToWords(50000)` → `"Fifty Thousand Only"`
- `amountToWords(125000)` → `"One Lakh Twenty Five Thousand Only"`
- `amountToWords(10000000)` → `"One Crore Only"`
- `amountToWords(15000000)` → `"One Crore Fifty Lakh Only"`
- `amountToWords(125000.50)` → **throws** (non-integer rupees not accepted)

**invoice-numbering.ts**
- `formatInvoiceNumber(1, 2026, 'XXXX/YY')` → `"0001/26"`
- `formatInvoiceNumber(7, 2026, 'XXXX/YY')` → `"0007/26"`
- `formatInvoiceNumber(100, 2026, 'XXXX/YY')` → `"0100/26"`
- `formatInvoiceNumber(1, 2030, 'XXXX/YY')` → `"0001/30"`

**schedule-engine.ts**
- `one_time` project → exactly 1 schedule item at the given due date
- `installments` with 3 caller-supplied items → exactly 3 items, amounts match, dates match
- `subscription` monthly with 12 cycles → 12 items, first at startDate + 1 month, last at startDate + 12 months
- `upfront_amc` with end date 12 months out, monthly AMC → 1 upfront + 12 AMC items
- Calling `buildSchedule` twice with same input → identical output (pure, deterministic)

**reminder-rules.ts**
```typescript
// Test setup
const rules: ReminderRule[] = [
  { id: 'r1', type: 'client_due_soon', offsetDays: -7,  enabled: true, ccFounders: false },
  { id: 'r2', type: 'client_due',      offsetDays: 0,   enabled: true, ccFounders: false },
  { id: 'r3', type: 'client_overdue',  offsetDays: 7,   enabled: true, ccFounders: false },
  { id: 'r4', type: 'client_overdue',  offsetDays: 15,  enabled: true, ccFounders: true  },
  { id: 'r5', type: 'internal_alert',  offsetDays: 30,  enabled: true, ccFounders: true  },
]
const invoice = { id: 'inv1', dueDate: new Date('2026-07-01'), status: 'overdue' }
```
- today = `2026-06-24` (7 days before due): `dueReminders` returns `[r1]` (due-soon fires)
- today = `2026-07-01` (due date): returns `[r1, r2]` (both -7 and 0 have fired)
- today = `2026-07-08` (7 days overdue): returns `[r1, r2, r3]`
- today = `2026-07-16` (15 days overdue): returns `[r1, r2, r3, r4]`
- today = `2026-07-31` (30 days overdue): returns `[r1, r2, r3, r4, r5]`
- With `alreadySentRuleIds = new Set(['r1', 'r2'])` on `2026-07-08`: returns `[r3]` only
- Disabled rule (`enabled: false`) never appears in output regardless of date
- `r3` and `r4` are **both** in the output on `2026-07-16` (different ruleIds — this is the key fix from A2)

### Acceptance criteria
- `pnpm test` → all tests pass, zero skipped
- `pnpm type-check` → zero errors in `packages/core`

---

## Phase 4 — Auth & App Shell

### What we do
Wire Supabase Auth. Protected layout. Navigation shell. Role gating utilities. UID link-on-first-login middleware. No real content pages yet.

### Files created/updated

```
apps/web/
  lib/
    supabase/
      client.ts                 # browser Supabase client
      server.ts                 # server Supabase client (cookies)
    auth/
      session.ts                # requireSession(), getCurrentUser()
      roles.ts                  # requireRole(), hasPermission(), PERMISSIONS map
      link-user.ts              # linkUidOnFirstLogin() — email-based UID update
  middleware.ts                 # session refresh + first-login UID link + route protection
  app/
    (auth)/
      login/
        page.tsx                # email + password form
        actions.ts              # signIn, signOut Server Actions
    (app)/
      layout.tsx                # sidebar nav, user menu, role-aware nav items
      page.tsx                  # placeholder redirect to dashboard
    globals.css
```

### First-login UID link (middleware logic)

```typescript
// middleware.ts — runs after session is validated:
const { data: { user } } = await supabase.auth.getUser()
if (user) {
  // Check if users table has a row matching this auth UID
  const existingByUid = await db.query.users.findFirst({
    where: eq(users.id, user.id)
  })
  if (!existingByUid) {
    // Try to match by email (for founders seeded before invite was accepted)
    await db.update(users)
      .set({ id: user.id })
      .where(eq(users.email, user.email))
    // If no row exists by email either, user is not authorized → sign out
  }
}
```

### Navigation items (sidebar)

```
Dashboard          /
Clients            /clients
Invoices           /invoices
Payments           /payments
Reminders          /reminders
────────────────────────────
Admin              /admin  (admin role only)
  Settings
  Bank Accounts
  Reminder Rules
  Email
  Users
  Audit Log
```

### Role gating

```typescript
// roles.ts
export const PERMISSIONS = {
  'clients:write':         ['admin', 'accountant'],
  'projects:write':        ['admin', 'accountant'],
  'invoices:write':        ['admin', 'accountant'],
  'payments:write':        ['admin', 'accountant'],
  'settings:write':        ['admin'],
  'users:write':           ['admin'],
  'bank-accounts:write':   ['admin'],
  'reminder-rules:write':  ['admin'],
} satisfies Record<string, ('admin' | 'viewer' | 'accountant')[]>
```

### Acceptance criteria
- Any `/(app)` route while logged out → redirects to `/login`
- Logging in with seeded founder email (after accepting invite) → redirects to `/`
- On first login, the `users.id` for that email is updated to match Supabase `auth.uid`
- Sidebar shows "Admin" only for `admin` role
- `accountant` and `viewer` roles: attempting a write Server Action returns `{ success: false, error: 'Forbidden' }`
- `pnpm build` and `pnpm lint` pass

---

## Phase 5 — Clients & Projects

### What we do
Full CRUD for clients and projects. Project creation calls `@eigensu/core` schedule engine and persists schedule items. Project detail shows schedule with multi-select "Generate Invoice."

### Files created

```
apps/web/app/(app)/
  clients/
    page.tsx                        # client list table
    new/
      page.tsx                      # create client form
    [id]/
      page.tsx                      # client detail (projects, invoices, balance)
      edit/
        page.tsx                    # edit client form

  projects/
    [id]/
      page.tsx                      # project detail (schedule table, invoices)
      edit/
        page.tsx                    # edit project + regenerate schedule

apps/web/lib/actions/
  clients.ts                        # createClient, updateClient, archiveClient
  projects.ts                       # createProject, updateProject
  schedule.ts                       # regenerateSchedule
```

### Project creation form flow

```
Step 1: Basic info
  Name, description, client (selector), start date, end date (optional)

Step 2: Payment model
  Radio: one_time | installments | subscription | upfront_amc

Step 3: Model-specific inputs
  one_time:
    → Due date
    → Total amount

  installments:
    → Add rows (label, amount, due date)
    → Running total shown vs project total
    → Validation: sum of installments = project total (enforced)

  subscription:
    → Amount per period
    → Recurrence (monthly / quarterly / yearly)
    → End date (required to bound the generated items)

  upfront_amc:
    → Upfront amount + due date
    → AMC amount per period
    → AMC recurrence
    → End date (bounds AMC items)

Step 4: Confirm & create
  → createProject action → schedule engine → persist scheduleItems
```

### Schedule items display (project detail)

Table columns: `Label | Type | Due Date | Amount | Status | Linked Invoice`

For the "Generate Invoice" flow:
- Each pending/overdue item has a **checkbox**
- Founder selects one or more items
- Clicks "Generate Invoice" → goes to `/invoices/new` with selected item IDs in query string
- Invoice creation page pre-fills from those items (line items, client, bank account)

> This replaces the v1 "one button per item" pattern. Bundling is now first-class.

### Acceptance criteria
- Create client → appears in list
- Archive client → hidden from active list; accessible via "Show archived" toggle
- Create `installments` project with three items → three schedule items in DB, sum equals total
- Validation error if installment sum ≠ project total
- Create `upfront_amc` project with monthly AMC through a given end date → upfront item + correct count of monthly items
- Edit project → pending schedule items regenerated; items with status `paid` or `partial` untouched
- Select two pending schedule items → "Generate Invoice" navigates to creation with both pre-filled
- `pnpm build` and `pnpm lint` pass

---

## Phase 6 — Invoice Package (`@eigensu/invoice`)

### What we do
Build the exact PDF template and render function. No web wiring yet — package works in isolation.

### Files created/updated

```
packages/invoice/src/
  InvoiceDocument.tsx             # @react-pdf template
  InvoicePreview.tsx              # in-browser preview (dynamic import, client-only)
  render.ts                       # renderToBuffer() → Promise<Buffer>
  types.ts                        # InvoiceRenderData
```

### `InvoiceRenderData` type

```typescript
interface InvoiceRenderData {
  invoiceNumber: string
  issueDate: string               // "15 Jun 2026"
  dueDate: string                 // "15 Jul 2026"
  client: {
    name: string
    contactPerson?: string
    phone: string
    billingAddress: string
  }
  lineItems: Array<{
    description: string
    amount: string                // pre-formatted with formatINR()
  }>
  subtotal: string                // pre-formatted
  taxLabel: string                // "Tax (0%)" or "Tax (18%)"
  tax: string                     // pre-formatted
  total: string                   // pre-formatted
  amountInWords: string
  bankAccount: {
    holderName: string
    accountNumber: string         // full number — this is the client's invoice, they need it
    ifsc: string
    upiId?: string
  }
  company: {
    name: string
    address: string
    phone: string
    email: string
    logoUrl?: string              // public URL from branding bucket, optional
  }
  declarationText: string
}
```

### PDF layout implementation

All dimensions and sizing are relative to the page (A4). No hardcoded pixel values — use @react-pdf style objects.

```typescript
// Key style constants — source from tailwind.preset.js values
const COLORS = {
  bg:      '#d6eaf5',   // eigensu-bg  ← VERIFY AGAINST ASSET BEFORE IMPLEMENTING
  blue:    '#86b9d4',   // eigensu-blue ← VERIFY AGAINST ASSET BEFORE IMPLEMENTING
  text:    '#1a1a1a',
  divider: '#b0cdd9',
}

// Page
<Page size="A4" style={{ backgroundColor: COLORS.bg, padding: 40, fontFamily: 'Helvetica' }}>

// Header row
<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
  <Text style={{ fontSize: 72, fontWeight: 'bold', color: '#000000' }}>Invoice</Text>
  <View style={{ alignItems: 'flex-end' }}>
    <Text style={{ fontSize: 11 }}>{issueDate}</Text>
    <Text style={{ fontSize: 11 }}><Text style={{ fontWeight: 'bold' }}>Invoice No. </Text>{invoiceNumber}</Text>
  </View>
</View>

// Horizontal divider (reusable)
<View style={{ borderBottom: `1pt solid ${COLORS.divider}`, marginVertical: 10 }} />

// Billed to block, line-items table, summary+words row, declaration, footer — per TECH §7
```

### `InvoicePreview.tsx`

```typescript
// Client-only — cannot SSR
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(m => m.PDFViewer), { ssr: false })

export function InvoicePreview({ data }: { data: InvoiceRenderData }) {
  return (
    <PDFViewer width="100%" height={700}>
      <InvoiceDocument data={data} />
    </PDFViewer>
  )
}
```

### Acceptance criteria
- Running `node -e "require('./render.ts'); ..."` or a test script → returns a Buffer with length > 0
- PDF opened in a viewer shows: colored background, "Invoice" at 72pt, client block, all line items, amount-in-words, summary totals, declaration, payment info footer with company info
- "Five" is spelled correctly throughout
- No font errors in the Node.js console
- `pnpm build` passes for `@eigensu/invoice`

---

## Phase 7 — Invoices (Web)

### What we do
Invoice creation (from selected schedule items OR manual), invoice detail page, PDF preview, send flow. Atomically allocates invoice number from DB sequence.

### Files created

```
apps/web/app/(app)/invoices/
  page.tsx                        # invoice list
  new/
    page.tsx                      # create invoice form
  [id]/
    page.tsx                      # invoice detail + preview

apps/web/app/api/invoices/[id]/pdf/
  route.ts                        # GET → signed URL → stream PDF

apps/web/lib/actions/
  invoices.ts                     # createInvoice, updateInvoice, cancelInvoice, sendInvoice

apps/web/lib/
  invoice-number.ts               # allocateInvoiceNumber() — DB sequence + formatter
```

### Invoice number allocation

```typescript
// apps/web/lib/invoice-number.ts
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
  const seq = result[0]!.seq
  return formatInvoiceNumber(seq, year, format)
}
```

### Invoice creation flow

```
If arriving from project detail with ?scheduleItems=id1,id2:
  → Load those scheduleItems from DB
  → Pre-fill: client (from project), line items from schedule item labels + amounts
  → Display a "Bundled from: [item labels]" summary
  → Founder can add/remove/edit line items

If arriving as Manual (/invoices/new with no query params):
  → Founder picks client (required)
  → Optionally picks project (narrows scope)
  → Adds line items manually

Common fields (both paths):
  Issue date (default today IST)
  Due date (default today IST + settings.defaultDueDays)
  Bank account (default: bankAccounts WHERE isDefault = true)
  Tax % (default: settings.defaultTaxPercent)

On submit (createInvoice action):
  1. requireSession + requireRole(['admin', 'accountant'])
  2. Zod validation:
     - total must be a whole rupee (no paise)
     - bankAccountId must be provided (NOT NULL)
  3. allocateInvoiceNumber(settings.invoiceNumberFormat) — atomic DB call
  4. core.amountToWords(total) — generate words
  5. db.insert(invoices)
  6. db.insert(invoiceLineItems) for each line item
  7. If scheduleItemIds present: db.insert(invoiceScheduleItems) for each
  8. @eigensu/invoice render(data) → Buffer
  9. supabase.storage.upload(buffer) → pdfPath
  10. db.update(invoices).set({ pdfPath })
  11. db.insert(auditLog)
  12. redirect to /invoices/[newId]
```

### Invoice detail page

```
[Header bar]
  Invoice #XXXX/YY  [status badge]  Issued: DD MMM  Due: DD MMM
  [Send] [Record Payment] [Download PDF] [Cancel]

[InvoicePreview]
  Client-side PDF viewer (500–700px tall)

[Payment history]
  Table: Date | Amount | Mode | Reference | Notes | Running Balance

[Outstanding balance]
  Large: ₹X,XX,XXX outstanding
```

Action button states:
- `Send`: enabled when status = `draft` or `sent` (re-send allowed)
- `Record Payment`: enabled when status ≠ `paid` and ≠ `cancelled`
- `Cancel`: enabled when status = `draft`
- `Download PDF`: always enabled if pdfPath exists

### Invoice list columns
`Invoice # | Client | Project | Issued | Due | Total | Outstanding | Status | Actions`

Status badge colors: draft=gray, sent=blue, partial=yellow, paid=green, overdue=red, cancelled=gray/line-through

### Acceptance criteria
- Create from schedule items → invoice bundles all selected items; `invoiceScheduleItems` rows created
- Same schedule item cannot be added to two invoices (DB UNIQUE constraint catches this)
- Invoice number is unique and in the configured format
- Invoice number allocated atomically — creating two invoices simultaneously produces consecutive numbers, not duplicates
- Amount-in-words is correct for any whole-rupee total
- Non-integer total → Zod error before DB
- PDF generated and stored; Preview shows it
- Send → Resend email sent; status → `sent`; `sentAt` set
- Download PDF returns the file
- Cancel → status = `cancelled`; no further actions possible
- `pnpm build` and `pnpm lint` pass

---

## Phase 8 — Payments

### What we do
Record full and partial payments. Recompute invoice status and — for fully-paid invoices — all linked schedule item statuses.

### Files created

```
apps/web/app/(app)/payments/
  page.tsx                        # all payments log

apps/web/lib/actions/
  payments.ts                     # recordPayment action

apps/web/components/
  record-payment-drawer.tsx       # form: amount, date, mode, reference, notes
```

### Payment recording logic

```typescript
// payments.ts (Server Action)
async function recordPayment(invoiceId: string, payment: PaymentInput) {
  // ... auth + role check ...

  // Sum all existing payments for this invoice
  const existing = await db.query.payments.findMany({ where: eq(payments.invoiceId, invoiceId) })
  const previousTotal = existing.reduce((s, p) => addAmounts(s, p.amount), 0)
  const newTotal = addAmounts(previousTotal, payment.amount)

  if (newTotal > invoice.total) {
    return { success: false, error: 'Payment exceeds invoice total' }
  }

  const newInvoiceStatus: InvoiceStatus =
    newTotal >= invoice.total ? 'paid'
    : newTotal > 0            ? 'partial'
    : invoice.status           // unchanged (e.g. overdue)

  await db.insert(payments).values({ ...payment, invoiceId })
  await db.update(invoices).set({ status: newInvoiceStatus }).where(eq(invoices.id, invoiceId))

  // If invoice is now fully paid, mark all linked schedule items as paid
  if (newInvoiceStatus === 'paid') {
    const links = await db.query.invoiceScheduleItems.findMany({
      where: eq(invoiceScheduleItems.invoiceId, invoiceId)
    })
    for (const link of links) {
      await db.update(scheduleItems)
        .set({ status: 'paid' })
        .where(eq(scheduleItems.id, link.scheduleItemId))
    }
  }
  // Note: partial payments do NOT update schedule item status —
  // items remain 'pending' until invoice is fully paid (see TECH §12)

  await writeAuditLog(...)
  return { success: true }
}
```

### Outstanding balance computation

```typescript
// Computed on read — never stored
const outstanding = subtractAmounts(invoice.total, sumPayments(invoice.payments))
```

Displayed on:
- Invoice detail (below payment history table)
- Client detail (aggregate: sum of all outstanding across non-cancelled invoices)
- Dashboard cards
- Invoice list "Outstanding" column

### Payments list columns
`Date | Invoice # | Client | Amount | Mode | Reference | Notes`

### Acceptance criteria
- Record payment equal to total → invoice `paid`; all linked schedule items → `paid`
- Record partial payment → invoice `partial`; schedule items remain `pending`
- Record second partial completing the total → invoice flips to `paid`; schedule items → `paid`
- Payment that would exceed total → rejected with error
- Outstanding balance computed correctly on all display surfaces
- `pnpm build` and `pnpm lint` pass

---

## Phase 9 — Email Package & Send Flow

### What we do
Build React Email templates. Wire Resend sender. Complete the "Send Invoice" action with real email delivery.

### Files created/updated

```
packages/email/src/
  templates/
    DueSoon.tsx                   # "Your invoice {{invoiceNumber}} is due in {{daysUntilDue}} days"
    DueToday.tsx                  # "Your invoice {{invoiceNumber}} is due today"
    Overdue.tsx                   # "Your invoice {{invoiceNumber}} is overdue"
    InternalAlert.tsx             # founders only — overdue summary table
  sender.ts                       # sendInvoiceEmail(), sendReminderEmail(), sendAlertEmail()
  types.ts                        # EmailPayload, AlertPayload types
  template-vars.ts                # interpolateTemplate(template, vars) — {{variable}} replacement
```

### Template variables

Client templates (used by `bodyTemplate` from `reminderRules`):
```
{{clientName}}
{{invoiceNumber}}
{{amount}}            # formatINR(invoice.total)
{{outstanding}}       # formatINR(outstanding)
{{dueDate}}           # "15 Jul 2026"
{{daysUntilDue}}      # positive integer (for due-soon)
{{daysOverdue}}       # positive integer (for overdue rules)
{{companyName}}
{{companyEmail}}
{{companyPhone}}
```

Internal alert template:
```
{{overdueCount}}
{{totalOutstanding}}    # formatINR(sum)
{{invoiceRows}}         # pre-built HTML table of overdue invoices
```

### Sender functions

```typescript
// sender.ts
async function sendInvoiceEmail(payload: {
  to: string
  subject: string
  htmlBody: string          // rendered from template + vars
  pdfBuffer: Buffer
  pdfFilename: string       // e.g. "Invoice-0007-26.pdf"
  cc?: string[]             // populated if ccFounders = true for this rule
}): Promise<void>

async function sendAlertEmail(payload: {
  to: string[]              // settings.founderEmails
  subject: string
  htmlBody: string
}): Promise<void>
```

### Template rendering

```typescript
// template-vars.ts
export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
// Unknown variables are left as-is (not silently swallowed)
```

### Acceptance criteria
- `sendInvoice` action: emails `client.email` with PDF attached; status → `sent`; `sentAt` set; `reminders` row written with the `client_due` rule's `ruleId`
- If that rule has `ccFounders = true`: founders are in CC
- Resend dashboard shows email with correct To, Subject, and PDF attachment
- Unknown template variables render as `{{variableName}}` not blank (allows easy spotting of config errors)
- `pnpm build` and `pnpm lint` pass

---

## Phase 10 — Automation Engine

### What we do
Build `/api/cron/daily` with all five steps and correct deduplication. Configure Vercel Cron. Handle failures per-item without aborting the entire run.

### Files created

```
apps/web/app/api/cron/daily/
  route.ts                        # POST handler

apps/web/lib/automation/
  today-ist.ts                    # getTodayIST() → Date
  generate-recurring.ts           # Step 1
  mark-overdue.ts                 # Step 2
  send-reminders.ts               # Steps 3 & 4
  run.ts                          # orchestrates all steps, returns CronSummary

vercel.json                       # cron config
```

### `getTodayIST()`

```typescript
// today-ist.ts
import { toZonedTime } from 'date-fns-tz'
import { startOfDay } from 'date-fns'

export function getTodayIST(): Date {
  const tz = process.env.APP_TIMEZONE ?? 'Asia/Kolkata'
  return startOfDay(toZonedTime(new Date(), tz))
}
```

Used by every step. Never use `new Date()` directly in the cron module.

### Security check

```typescript
// route.ts (first thing in handler)
const secret = request.headers.get('authorization')?.replace('Bearer ', '')
if (!secret || secret !== process.env.CRON_SECRET) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Idempotency guards (revised from v1)

| Step | Guard |
|---|---|
| Generate recurring | Check `scheduleItemId NOT IN (SELECT scheduleItemId FROM invoiceScheduleItems)` |
| Mark overdue | Idempotent UPDATE with same WHERE → safe to re-run |
| Send reminders | Check `reminders WHERE invoiceId = ? AND ruleId = ? AND (status = 'sent' OR (status = 'failed' AND retryCount >= 3))` |
| Internal alerts | Same check with `type = 'internal_alert'` ruleId |

### Per-run cap

Each of Steps 1, 3, 4 processes a maximum of **50 items per run**. This prevents Vercel function timeout (max 60s on Pro). Remaining items are processed on the next daily run. Correctness is maintained by idempotency guards.

### Failure handling in Step 3/4

```typescript
// send-reminders.ts
for (const firing of firings.slice(0, 50)) {
  const reminderId = await db.insert(reminders).values({
    ruleId: firing.rule.id,
    type: firing.rule.type,
    invoiceId: invoice.id,
    status: 'pending',
    recipients: [client.email],
    scheduledFor: firing.scheduledFor,
    retryCount: 0,
  }).returning({ id: reminders.id })

  try {
    await sendReminderEmail({ ... })
    await db.update(reminders)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(reminders.id, reminderId))
    summary.sentCount++
  } catch (err) {
    await db.update(reminders)
      .set({ status: 'failed', error: String(err), retryCount: sql`retry_count + 1` })
      .where(eq(reminders.id, reminderId))
    summary.failedCount++
    // Do not rethrow — continue to next item
  }
}
```

### `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 3 * * *"
    }
  ]
}
```

`0 3 * * *` UTC = 08:30 IST. Requires **Vercel Pro** (Hobby plan does not support custom cron schedules beyond the daily limit).

### CronSummary return type

```typescript
interface CronSummary {
  generatedInvoices: number
  overdueFlagged: number
  remindersSent: number
  remindersSkipped: number
  remindersFailed: number
  alertsSent: number
  todayIST: string         // "2026-07-08" for audit
}
```

### Acceptance criteria
- POST with wrong/missing secret → 401; no DB writes
- POST with correct secret → runs all steps, returns `CronSummary` JSON
- Running twice in the same day → `remindersSent = 0` on second run (dedup works)
- Two `client_overdue` rules both fire on their respective offset days (A2 fix confirmed)
- Failed send → `reminders.status = 'failed'`; retry on next run; after 3 retries, not retried again
- An AMC schedule item with `dueDate ≤ today` and no linked invoice → creates invoice
- Same AMC item on second run → no duplicate invoice created
- `pnpm build` and `pnpm lint` pass

---

## Phase 11 — Dashboard

### What we do
Build the main dashboard with correct summary cards, charts, and action lists.

### Files created

```
apps/web/app/(app)/
  page.tsx                        # dashboard (RSC, all data server-side)

apps/web/components/dashboard/
  summary-cards.tsx
  monthly-chart.tsx               # recharts: received vs billed
  outstanding-by-client.tsx       # recharts: bar chart
  due-this-month.tsx              # table
  overdue-list.tsx                # table + "Send Reminder" action
```

### Summary card data

```typescript
// All four cards computed server-side in page.tsx
const totalBilled =
  await db.select({ v: sum(invoices.total) })
    .from(invoices)
    .where(not(inArray(invoices.status, ['cancelled'])))
  // → sum of all non-cancelled invoice totals

const totalReceived =
  await db.select({ v: sum(payments.amount) })
    .from(payments)
  // → sum of all recorded payments (irrespective of invoice status)

// outstanding = total - received, for non-cancelled, non-paid invoices
const outstandingResult = await db
  .select({
    invoiceId: invoices.id,
    total: invoices.total,
    paid: sum(payments.amount),
  })
  .from(invoices)
  .leftJoin(payments, eq(payments.invoiceId, invoices.id))
  .where(not(inArray(invoices.status, ['cancelled', 'paid'])))
  .groupBy(invoices.id)
const totalOutstanding = outstandingResult.reduce(
  (s, r) => addAmounts(s, subtractAmounts(r.total, r.paid ?? 0)), 0
)

// Overdue card: sum of OUTSTANDING (not gross total) for overdue invoices only
// This is the A3 fix — avoids double-counting partially-paid overdue invoices
const overdueResult = await db
  .select({ total: invoices.total, paid: sum(payments.amount) })
  .from(invoices)
  .leftJoin(payments, eq(payments.invoiceId, invoices.id))
  .where(eq(invoices.status, 'overdue'))
  .groupBy(invoices.id)
const totalOverdue = overdueResult.reduce(
  (s, r) => addAmounts(s, subtractAmounts(r.total, r.paid ?? 0)), 0
)
```

Cards displayed: **Total Billed · Received · Outstanding · Overdue (outstanding only)**

### Chart: Monthly Received vs Billed
- X axis: last 12 months (IST month boundaries)
- Two bars: `billed` (sum of invoice.total where issueDate in that month), `received` (sum of payment.amount where dateReceived in that month)
- Both queries use IST-aware date truncation: `date_trunc('month', ... AT TIME ZONE 'Asia/Kolkata')`

### Due this month table
Filter: `dueDate BETWEEN todayIST AND last_day_of_month(todayIST) AND status NOT IN ('paid', 'cancelled')`
Columns: `Client | Invoice # | Due Date | Amount | Outstanding | Status | Action`

### Overdue list
Filter: `status = 'overdue'`
Columns: `Client | Invoice # | Days Overdue | Total | Outstanding | Last Reminder | Action`
"Send Reminder" quick action: calls `sendInvoice` with the most-recently-due enabled reminder rule for that invoice.

### Acceptance criteria
- "Overdue" card shows `sum(total - payments_received)` for overdue invoices, **not** `sum(total)`
- A partially-paid overdue invoice: `total - partialPayment` shown in Overdue card (A3 fix confirmed)
- Charts show correct data for the current month
- "Due this month" list matches DB query
- "Send Reminder" sends email, logs reminder row, page refreshes
- `pnpm build` and `pnpm lint` pass

---

## Phase 12 — Admin Panel

### What we do
Complete admin panel. Every setting configurable from the UI. All mutations audit-logged.

### Files created

```
apps/web/app/(app)/admin/
  layout.tsx                      # admin sub-nav
  settings/
    page.tsx                      # company info + invoice settings
  bank-accounts/
    page.tsx
    [id]/edit/
      page.tsx
  reminder-rules/
    page.tsx
  email/
    page.tsx
  users/
    page.tsx
  audit-log/
    page.tsx                      # filterable log

apps/web/lib/actions/
  admin.ts                        # all admin Server Actions
```

### Settings page fields
- Company name, address, phone, email
- Logo upload (image file → branding bucket → `settings.logoUrl`)
- Default tax % (0–100, whole numbers enforced)
- Invoice number format (text, preview shown: "Format: XXXX/YY → 0007/26")
- Default due days (integer)
- Declaration text (textarea, ~200 chars max shown in preview)
- Founder alert emails (tag input, max 5 addresses)
- Auto-send recurring invoices (toggle, default off)

### Reminder rules page
Table of all `reminderRules`, ordered by `sortOrder`. Each row inline-editable:
- Type (display only)
- Offset days (input, negative allowed, label shows "7 days before due" or "15 days after due")
- Enabled (toggle)
- Subject (text input)
- Body template (textarea, variable reference below it: `{{clientName}} {{invoiceNumber}} ...`)
- CC Founders (toggle)
- Save (per-row)

### Bank accounts page
- List: label, holder, last-4 of account number, IFSC, "Default" badge
- "Add account" → modal
- "Set as default" (unsets previous default in the same transaction)
- "Edit" → modal
- "Delete" → confirm dialog; blocked if any invoice references this account

### Users page
- List: email, name, role, status (invited / active)
- "Change role" dropdown (admin only; cannot demote yourself)
- "Invite new user" → calls `supabase.auth.admin.inviteUserByEmail()` + inserts `users` row
- "Revoke access" → deletes from `users` + `supabase.auth.admin.deleteUser()`

### Email page
- `RESEND_API_KEY` display (first 8 chars + `***`)
- `EMAIL_FROM` display (read-only, from env)
- Founder alert emails (shows current `settings.founderEmails`, editable from settings page)
- "Send test email" → sends a sample `InternalAlert` to the currently logged-in user's email
- Link to Resend dashboard (external)

### Audit log page
Table columns: `Timestamp | User | Action | Entity Type | Entity ID | Details`
Filters: date range, user selector, entity type selector
Details cell: expandable JSON `<pre>` block
Pagination: 50 rows per page

### Acceptance criteria
- Settings change → immediately reflected in next invoice/email
- Changing invoice format → `allocateInvoiceNumber` uses new format
- Changing bank account default → new invoices pre-select new default
- Changing declaration text → next PDF generation uses new text
- Logo upload → `settings.logoUrl` updated; next PDF includes logo
- Auto-send toggle change → cron behavior changes on next run
- Changing reminder rule offset + subject → next cron firing uses new values
- Invite new user → user receives email, on first login is linked with correct role
- "Set as default" bank account → previous default un-set (no two defaults simultaneously)
- "Delete" bank account referenced by an invoice → blocked with clear error
- `viewer` accessing `/admin` → 403 redirect
- Every admin mutation in `auditLog`
- `pnpm build` and `pnpm lint` pass

---

## Phase 13 — Polish & Deploy

### What we do
Empty states, error handling, final acceptance tests, README, deploy notes.

### Files created/updated

```
apps/web/components/
  empty-state.tsx                 # icon + heading + body + optional CTA button
  error-boundary.tsx              # error.tsx wrapper

apps/web/app/(app)/
  error.tsx                       # caught by Next.js layout
  not-found.tsx
```

### Empty states

| Page | Heading | CTA |
|---|---|---|
| Clients list | "No clients yet" | "Add client" |
| Invoices list | "No invoices yet" | "Create invoice" |
| Payments log | "No payments recorded" | — |
| Reminders page | "No reminders sent yet" | — |
| Dashboard overdue list | "No overdue invoices" | — |
| Project schedule (no items) | "Schedule not yet generated" | — |

### Error handling rules
- Server Actions: always return `{ success: boolean; error?: string }` — never throw to the client
- `error.tsx`: shows "Something went wrong" + Retry button (calls `router.refresh()`)
- Cron: per-step try/catch; failure in one step does not abort others; all failures logged
- 404 for unknown invoice/client IDs: `not-found.tsx` page

### Final acceptance criteria (full suite)

- [ ] `pnpm build`, `pnpm lint`, `pnpm type-check` all pass with zero errors
- [ ] `pnpm test` → all core unit tests pass, zero skipped
- [ ] Creating an `installments` project with three items → items sum to project total; error shown if they don't
- [ ] Creating an `upfront_amc` project → upfront item + correct count of monthly AMC items
- [ ] Selecting two schedule items → one bundled invoice with two line items; both `invoiceScheduleItems` rows created
- [ ] Same schedule item cannot be included in two invoices (DB constraint enforced + UI blocks it)
- [ ] Invoice number is unique; two simultaneous creates do not produce duplicates (sequence-based)
- [ ] PDF matches template: colored background, 72pt header, billed-to, line items, amount-in-words, summary, declaration, footer
- [ ] "Five" spelled correctly throughout PDF (not "Fife")
- [ ] Non-integer invoice total rejected by Zod before DB write
- [ ] Partial payment → invoice `partial`; schedule items remain `pending`
- [ ] Payment completing invoice → invoice `paid`; all linked schedule items → `paid`
- [ ] Payment exceeding total → rejected with error
- [ ] "Overdue" dashboard card shows outstanding balance only, not gross total
- [ ] Cron: AMC schedule item with `dueDate ≤ today` and no invoice → invoice created
- [ ] Cron: same item on second run → no duplicate
- [ ] Cron: `client_overdue` at +7d fires independently from `client_overdue` at +15d (A2 fix)
- [ ] Cron: failed send → `reminders.status = 'failed'`; retried next run; stops after 3 tries
- [ ] Past 30-day threshold → `InternalAlert` to both founders
- [ ] `autoSendRecurring = false` → cron creates draft invoices, not sent
- [ ] `autoSendRecurring = true` → cron creates and sends invoices automatically
- [ ] Admin settings change → reflected in next invoice/PDF
- [ ] First login UID link flow: seeded user row updated with real Supabase auth UID
- [ ] `viewer` role: all mutation actions return 403; `/admin` routes redirect
- [ ] `accountant` role: no admin routes accessible; invoices/payments/clients writable
- [ ] Every mutation appears in `auditLog`
- [ ] Cron run appears in `auditLog` with summary stats

### README (committed to repo root)

```markdown
# Eigensu Billing

Internal invoice and receivables management for Eigensu consulting.

## First-time setup

1. Create a Supabase project (Postgres + Auth + Storage)
2. Create two Storage buckets: `invoices` (private) and `branding` (public)
3. Sign up for Resend and get an API key
4. Deploy to Vercel (Pro plan required for Cron)
5. Clone this repo and run:

   cp .env.example .env
   # Fill all values in .env
   pnpm install
   pnpm db:generate && pnpm db:migrate
   pnpm --filter @eigensu/db seed          # sends founder invite emails

6. Founders accept invite emails and set passwords
7. pnpm dev  (local) or deploy to Vercel

## Key commands

pnpm dev            # start local dev server
pnpm build          # production build
pnpm lint           # ESLint check
pnpm type-check     # TypeScript check
pnpm test           # run Vitest unit tests
pnpm db:generate    # generate Drizzle migrations from schema changes
pnpm db:migrate     # apply pending migrations

## Cron

Vercel Cron fires daily at 08:30 IST (configured in vercel.json).
To test locally: POST /api/cron/daily with Authorization: Bearer <CRON_SECRET>
```

---

## Dependency Order Between Phases

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3
                                       │
                                  Phase 4 (Auth)
                                       │
                                  Phase 5 (Clients/Projects)
                                       │
                     ┌─────────────────┤
                     │                 │
                Phase 6 (PDF)     Phase 8 (Payments)
                     │
                Phase 7 (Invoices)
                     │
                Phase 9 (Email)
                     │
                Phase 10 (Cron)
                     │
                Phase 11 (Dashboard)
                     │
                Phase 12 (Admin)
                     │
                Phase 13 (Polish)
```

Phases 6 and 8 are independent and can run in parallel after Phase 5. All others are sequential.

---

## What Is NOT in Scope for v1

- **GST invoices** — no GSTIN, no CGST/SGST/IGST split, no HSN/SAC. v1 is 0% tax only.
- **Encryption at rest** for bank account numbers — app-layer auth + role checks are the v1 security model.
- **Multi-currency** — INR only.
- **Client portal** — no client-facing login.
- **Stripe / payment gateway** — manual recording only.
- **Row Level Security (RLS)** — app-layer authorization only.
- **Mobile app.**
- **Bulk import** of historical invoices.
- **Custom invoice templates** — one Eigensu template only.
- **Time tracking or project management.**

---

## Change Log (v1.0 → v2.0)

| Gap | Change |
|---|---|
| A1 | Phase 5: Generate Invoice is now multi-select; Phase 7: `createInvoice` writes `invoiceScheduleItems`; Phase 8: payment reconciliation marks all linked items |
| A2 | Phase 3: reminder-rules tests now verify two `client_overdue` rules fire independently; Phase 10: dedup uses `ruleId` not `type` |
| A3 | Phase 11: Overdue card formula changed to `sum(total - paid_payments)` for overdue invoices |
| A4 | Phase 7: `allocateInvoiceNumber()` introduced using DB sequence; `core.nextInvoiceNumber()` replaced by `core.formatInvoiceNumber()` |
| A5 | Phase 10: per-item try/catch; `reminders.status = 'failed'` on error; retry up to 3x |
| B1 | Phase 1: single `tailwind.preset.js` source for both colors; both marked "verify against asset" |
| B2 | Phase 6: font size is 72pt (not 60pt) |
| B3 | Phase 1: `test` task added to `turbo.json`; `test` script added to root `package.json` |
| B4 | Phase 3: `toPaise`, `fromPaise`, `subtractAmounts` added; `amountToWords` test asserts throw on non-integer |
| C1 | Phase 2 seed + Phase 12 admin: bank account number is plaintext; security model documented; encryption is v2 |
| C2 | Phase 2 env: `SUPABASE_BRANDING_BUCKET` added; Phase 12: logo upload to branding bucket |
| C3 | Phase 4: first-login UID link logic implemented in middleware |
| C4 | Phase 4: authorization described as app-layer only; no RLS wiring |
| C5 | Phase 10: 50-item per-step cap; Vercel Pro requirement noted |
| C6 | Out-of-scope section: GST explicitly listed |
| C7 | Phase 1: `date-fns-tz` in stack; Phase 10: `getTodayIST()` used throughout; Phase 11: chart queries use IST month boundaries |
| autoSend | Phase 2 seed: `autoSendRecurring: false` in settings; Phase 10: cron respects this flag |

---

*End of Implementation Specification v2.0. Please review and approve before implementation begins.*
