# Eigensu Billing — Technical Specification

> **⚠️ MIGRATION NOTE (2026-07):** This document predates the migration off
> Supabase. The stack is now **Railway Postgres + NextAuth v5 (credentials,
> JWT sessions) + Cloudinary** (logo storage). References to Supabase
> Auth/Storage below are historical — see `MIGRATION_NOTES.md` for what
> changed.


**Version:** 2.0  
**Date:** 2026-06-19  
**Status:** Awaiting Approval  
**Authors:** Eigensu Engineering  
**Changes from v1.0:** All gaps from the 19 June gap analysis addressed — see §13 for change log.

---

## 1. Problem Statement

Eigensu currently tracks receivables in a spreadsheet and drafts invoices by hand. Three pain points drive this build:

- Recurring AMC billing is forgotten or delayed.
- No systematic reminder process for late clients.
- No single source of truth for what is billed, received, and outstanding.

**Goal:** One internal tool that generates branded invoices, tracks every payment, and automatically reminds clients and founders — without human intervention after initial project setup.

---

## 2. Tech Stack (Locked — No Substitutions)

| Concern | Choice | Rationale |
|---|---|---|
| Monorepo | **Turborepo** | Caching, pipeline orchestration, workspace isolation |
| Package manager | **pnpm** (workspaces) | Disk efficiency, strict hoisting, workspace protocol |
| Framework | **Next.js 15** (App Router) | RSC for reads, Server Actions for mutations, single deployment target |
| Language | **TypeScript** (strict) | End-to-end type safety from DB schema to UI |
| Styling | **Tailwind CSS** + **shadcn/ui** | Rapid UI with accessible primitives |
| Database | **Postgres** via **Supabase** | Managed, reliable, co-located with Auth and Storage |
| ORM | **Drizzle ORM** + drizzle-kit | Type-safe queries, migrations as code, no magic |
| Auth | **Supabase Auth** (email/password) | JWT sessions, invite-only founders — authorization is **app-layer only** (see §10) |
| File storage | **Supabase Storage** | Co-located with DB, signed URLs for PDF access |
| PDF generation | **@react-pdf/renderer** | JSX-based, exact layout control, works server-side |
| Email | **Resend** + **React Email** | Deliverability, React-native templates, PDF attachments |
| Validation | **Zod** | Runtime + compile-time, composable, works in Server Actions |
| Forms | **react-hook-form** + zod resolver | Controlled forms, no re-renders, consistent error model |
| Tables | **@tanstack/react-table** | Headless, sortable, filterable, SSR-compatible |
| Dates | **date-fns** + **date-fns-tz** | Tree-shakeable; `date-fns-tz` provides IST-correct "today" (see §12) |
| Cron | **Vercel Cron** → `/api/cron/daily` | **Requires Vercel Pro or higher**; fires at `0 3 * * *` UTC (08:30 IST) |
| Charts | **recharts** | React-native, composable, no canvas complexity |
| Lint/format | **ESLint** + **Prettier** | Standard, integrated with VSCode |
| Testing | **Vitest** (unit, `packages/core` only) | Fast, ESM-native, no DOM overhead needed for pure logic |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Vercel (Pro or higher)                     │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              apps/web (Next.js 15)                  │   │
│   │                                                     │   │
│   │  RSC Pages ──► Server Actions ──► @eigensu/core    │   │
│   │       │               │                             │   │
│   │  Client Components    │                             │   │
│   │  (forms, charts,      │                             │   │
│   │   PDF preview)        ▼                             │   │
│   │              @eigensu/db (Drizzle)                  │   │
│   └─────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│   Vercel Cron ──► /api/cron/daily (08:30 IST daily)        │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
   Supabase DB   Supabase        Supabase
   (Postgres)    Storage         Auth
                 (PDFs,          (sessions)
                  logos)            │
                              Resend API
                              (emails)
```

### Data flow for a new invoice

```
Founder creates project
       │
       ▼
schedule-engine (core) builds scheduleItems
       │
       ▼
Founder selects one or more pending schedule items → "Generate Invoice"
       │
       ▼
Server Action: createInvoice()
  → validates input (Zod)
  → allocates invoice number atomically (DB sequence — see §12)
  → writes invoice + lineItems + invoiceScheduleItems links (Drizzle)
  → calls @eigensu/invoice render()
  → uploads PDF to Supabase Storage (invoices bucket)
  → writes auditLog
       │
       ▼
Founder clicks "Send"
  → sends email via Resend (PDF attached)
  → updates invoice.sentAt, status → sent
  → writes reminders row (linked to ruleId)
       │
       ▼
Vercel Cron (08:30 IST daily)
  → auto-generates next AMC/subscription invoices
  → marks overdue
  → fires tiered client reminders (deduped by ruleId)
  → escalates to founders if threshold passed
```

---

## 4. Monorepo Layout

```
eigensu-billing/
├── apps/
│   └── web/
│       ├── app/                        # Next.js App Router
│       │   ├── (auth)/
│       │   │   └── login/
│       │   ├── (app)/                  # Protected layout
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx            # Dashboard
│       │   │   ├── clients/
│       │   │   ├── projects/
│       │   │   ├── invoices/
│       │   │   ├── payments/
│       │   │   ├── reminders/
│       │   │   └── admin/
│       │   └── api/
│       │       ├── cron/
│       │       │   └── daily/
│       │       └── invoices/
│       │           └── [id]/
│       │               └── pdf/
│       ├── components/
│       ├── lib/
│       └── middleware.ts
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   ├── core/
│   │   ├── src/
│   │   │   ├── schedule-engine.ts
│   │   │   ├── reminder-rules.ts
│   │   │   ├── money.ts
│   │   │   ├── number-to-words.ts
│   │   │   └── invoice-numbering.ts
│   │   └── src/__tests__/
│   │
│   ├── invoice/
│   │   ├── src/
│   │   │   ├── InvoiceDocument.tsx
│   │   │   ├── InvoicePreview.tsx
│   │   │   └── render.ts
│   │   └── package.json
│   │
│   ├── email/
│   │   ├── src/
│   │   │   ├── templates/
│   │   │   │   ├── DueSoon.tsx
│   │   │   │   ├── DueToday.tsx
│   │   │   │   ├── Overdue.tsx
│   │   │   │   └── InternalAlert.tsx
│   │   │   └── sender.ts
│   │   └── package.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── theme.ts
│   │   └── package.json
│   │
│   └── config/
│       ├── tsconfig.base.json
│       ├── eslint.config.js
│       └── tailwind.preset.js
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

---

## 5. Database Schema

All tables: UUID primary keys (`gen_random_uuid()`), `createdAt`/`updatedAt` timestamps. Money stored as **`numeric(12,2)`**. Invoices accept only whole-rupee totals (no paise) — enforced at the Zod validation layer. Soft-delete via typed status enums where noted.

### Enums

```typescript
paymentModel:    'one_time' | 'installments' | 'subscription' | 'upfront_amc'
scheduleType:    'one_time' | 'installment' | 'amc' | 'subscription'
scheduleStatus:  'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
invoiceStatus:   'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'
recurrence:      'none' | 'monthly' | 'quarterly' | 'yearly'
reminderType:    'client_due_soon' | 'client_due' | 'client_overdue' | 'internal_alert'
reminderStatus:  'pending' | 'sent' | 'failed' | 'skipped'
userRole:        'admin' | 'viewer' | 'accountant'
clientStatus:    'active' | 'archived'            // ← now a pgEnum, not plain text
projectStatus:   'active' | 'completed' | 'archived'  // ← now a pgEnum, not plain text
```

### Tables

#### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| contactPerson | text | |
| phone | text | |
| email | text NOT NULL | |
| billingAddress | text | |
| gstId | text | nullable |
| status | clientStatus enum | default `'active'` |
| notes | text | nullable |
| createdAt, updatedAt | timestamptz | |

#### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| clientId | uuid FK → clients | ON DELETE RESTRICT |
| name | text NOT NULL | |
| description | text | nullable |
| paymentModel | paymentModel enum | |
| totalValue | numeric(12,2) | |
| currency | text | default `'INR'` |
| startDate | date | |
| endDate | date | nullable |
| amcAmount | numeric(12,2) | nullable, used by `upfront_amc` |
| amcRecurrence | recurrence enum | nullable |
| status | projectStatus enum | default `'active'` |
| createdAt, updatedAt | timestamptz | |

#### `scheduleItems`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | uuid FK → projects | ON DELETE CASCADE |
| type | scheduleType enum | |
| label | text | e.g. "1st Installment", "AMC – July" |
| amount | numeric(12,2) | |
| dueDate | date | |
| recurrence | recurrence enum | |
| status | scheduleStatus enum | default `'pending'` |
| createdAt, updatedAt | timestamptz | |

> **Note:** The `generatedInvoiceId` column from v1 is **removed**. The invoice ↔ schedule relationship is now many-to-many via `invoiceScheduleItems` — see below.

#### `invoiceSequences`
| Column | Type | Notes |
|---|---|---|
| year | int PK | calendar year (e.g. 2026) |
| lastSeq | int NOT NULL | default 0, atomically incremented |

Used to allocate invoice numbers without a race condition. Rows are inserted on first invoice of each year. See §12 (Invoice numbering).

#### `invoices`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoiceNumber | text UNIQUE NOT NULL | e.g. `0001/26` |
| clientId | uuid FK → clients | ON DELETE RESTRICT |
| projectId | uuid FK → projects | nullable |
| issueDate | date | |
| dueDate | date | |
| subtotal | numeric(12,2) | |
| tax | numeric(12,2) | default 0 |
| total | numeric(12,2) | |
| amountInWords | text | |
| status | invoiceStatus enum | default `'draft'` |
| pdfPath | text | Supabase Storage key (invoices bucket), nullable until PDF is generated |
| bankAccountId | uuid FK → bankAccounts | NOT NULL — must choose an account |
| sentAt | timestamptz | nullable |
| createdAt, updatedAt | timestamptz | |

> **Note:** `scheduleItemId` from v1 is **removed**. Invoice→schedule links live in `invoiceScheduleItems`.

#### `invoiceScheduleItems` (join table)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoiceId | uuid FK → invoices | ON DELETE CASCADE |
| scheduleItemId | uuid FK → scheduleItems | ON DELETE RESTRICT, **UNIQUE** |

The UNIQUE constraint on `scheduleItemId` ensures one schedule item can only appear on one invoice. This enforces the "bundle" model: multiple items per invoice is allowed, but a single item cannot be double-billed.

#### `invoiceLineItems`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoiceId | uuid FK → invoices | ON DELETE CASCADE |
| description | text | |
| amount | numeric(12,2) | |
| sortOrder | int | |

#### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoiceId | uuid FK → invoices | ON DELETE RESTRICT |
| amount | numeric(12,2) | |
| dateReceived | date | |
| mode | text | `'bank' \| 'upi' \| 'cash' \| 'other'` |
| reference | text | nullable |
| notes | text | nullable |
| createdAt | timestamptz | |

#### `bankAccounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| holderName | text | |
| accountNumber | text | stored as **plaintext** (see §10 — v1 authorization model) |
| ifsc | text | |
| upiId | text | nullable |
| label | text | display name |
| isDefault | boolean | exactly one row should be true |
| createdAt, updatedAt | timestamptz | |

> In the UI, account numbers are displayed as last-4 digits only in non-admin views (e.g. invoice PDF shows the full number since it is a client-facing document, but the bank accounts admin list shows last-4).

#### `reminders`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ruleId | uuid FK → reminderRules | NOT NULL — links to the specific rule that fired |
| type | reminderType enum | denormalized from rule for query convenience |
| invoiceId | uuid FK → invoices | ON DELETE CASCADE |
| scheduledFor | date | |
| sentAt | timestamptz | nullable |
| status | reminderStatus enum | |
| recipients | text[] | |
| retryCount | int | default 0, max 3 |
| error | text | nullable — populated when status = 'failed' |
| createdAt | timestamptz | |

**Dedup key:** `UNIQUE (invoiceId, ruleId)` — one reminder per rule per invoice. This correctly permits two `client_overdue` reminders (at +7d and +15d) because they have different `ruleId` values.

#### `reminderRules`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| type | reminderType enum | |
| offsetDays | int | negative = before due date; positive = after |
| enabled | boolean | |
| subject | text | |
| bodyTemplate | text | `{{variable}}` placeholders |
| ccFounders | boolean | if true, founders are CC'd on this rule's emails |
| sortOrder | int | display order in admin UI |
| createdAt, updatedAt | timestamptz | |

#### `settings` (single row, id = well-known UUID)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| companyName | text | |
| address | text | |
| phone | text | |
| email | text | |
| logoUrl | text | nullable; Supabase Storage key (branding bucket) |
| defaultTaxPercent | numeric(5,2) | |
| defaultCurrency | text | default `'INR'` |
| invoiceNumberFormat | text | default `'XXXX/YY'` |
| defaultDueDays | int | |
| declarationText | text | |
| founderEmails | text[] | |
| autoSendRecurring | boolean | default false — whether cron auto-sends generated invoices |
| createdAt, updatedAt | timestamptz | |

> `autoSendRecurring`: when `false` (default), the cron creates invoices as `draft` and founders review before sending. When `true`, invoices are auto-sent immediately on creation.

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | **mirrors Supabase Auth UID** — see §10 for provisioning flow |
| email | text UNIQUE | used for lookup-on-first-login |
| name | text | |
| role | userRole enum | |

#### `auditLog`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | uuid | nullable (cron runs have no user) |
| action | text | e.g. `'CREATE_INVOICE'`, `'RECORD_PAYMENT'`, `'CRON_RUN'` |
| entityType | text | e.g. `'invoice'`, `'client'` |
| entityId | uuid | nullable |
| meta | jsonb | before/after diff or summary |
| createdAt | timestamptz | |

---

## 6. Core Domain Logic (`@eigensu/core`)

All functions are pure (no DB calls, no I/O). Fully unit-tested with Vitest.

### 6.1 Schedule Engine

```typescript
// Given a project config, returns the full set of scheduleItems to persist.
// Re-runnable: produces the same output deterministically, allowing upsert.
// Items with status 'paid' or 'partial' in existing must be excluded from overwrite
// (the caller handles this — this function is pure and unaware of existing state).

function buildSchedule(project: ProjectConfig): ScheduleItemDraft[]

interface ProjectConfig {
  id: string
  paymentModel: PaymentModel
  startDate: Date
  endDate?: Date
  totalValue: number            // whole rupees only
  currency: string
  // installments model:
  installments?: Array<{ label: string; amount: number; dueDate: Date }>
  // subscription model:
  subscriptionAmount?: number
  subscriptionRecurrence?: Recurrence
  // upfront_amc model:
  upfrontAmount?: number
  upfrontDueDate?: Date
  amcAmount?: number
  amcRecurrence?: Recurrence
  // one_time model:
  oneTimeDueDate?: Date
}
```

**Logic per payment model:**

| Model | What it generates |
|---|---|
| `one_time` | Single item, due at `oneTimeDueDate` |
| `installments` | N items from the caller-supplied `installments` array |
| `subscription` | Recurring items from `startDate` at `subscriptionRecurrence`, up to `endDate` |
| `upfront_amc` | One upfront item at `upfrontDueDate`, then recurring AMC items from first month after upfront through `endDate` |

### 6.2 Reminder Rules Engine

```typescript
// Given an invoice, the full rule set, and today's date (in IST),
// returns the rules that should fire.
// alreadySentRuleIds: Set of ruleIds already sent for this invoice — these are excluded.

interface ReminderRule {
  id: string
  type: ReminderType
  offsetDays: number
  enabled: boolean
  ccFounders: boolean
}

interface InvoiceSummary {
  id: string
  dueDate: Date
  status: InvoiceStatus
}

interface ReminderFiring {
  rule: ReminderRule
  scheduledFor: Date         // the date this reminder was "due" to fire
}

function dueReminders(
  invoice: InvoiceSummary,
  rules: ReminderRule[],
  todayIST: Date,
  alreadySentRuleIds: Set<string>
): ReminderFiring[]
```

Logic: for each enabled rule, compute `fireDate = invoice.dueDate + offsetDays`. If `fireDate ≤ todayIST` and `rule.id` is not in `alreadySentRuleIds`, include it in the result.

### 6.3 Money

```typescript
// Conversion helpers — all arithmetic goes via paise to avoid float errors
function toPaise(rupees: number): number      // Math.round(rupees * 100)
function fromPaise(paise: number): number     // paise / 100

// Safe arithmetic (internally uses toPaise/fromPaise)
function addAmounts(a: number, b: number): number
function subtractAmounts(a: number, b: number): number
function computeTax(subtotal: number, taxPercent: number): number  // returns whole rupees

// Indian grouping format: e.g. 125000 → "₹1,25,000"
function formatINR(amount: number): string
```

### 6.4 Number-to-Words (Indian System)

```typescript
// Accepts whole rupees only (integer or .00 decimal).
// Throws if a non-integer value is provided.
// 125000 → "One Lakh Twenty Five Thousand Only"
// Uses Indian grouping: crore → lakh → thousand → hundred
// Canonical spelling: "Five" not "Fife"

function amountToWords(amount: number): string
```

### 6.5 Invoice Numbering

The `core` function is responsible only for **formatting**. Sequence allocation is done atomically in the DB (see §12). This eliminates the read-then-write race condition from v1.

```typescript
// Given a sequence number and year, format per the configured format string.
// "XXXX" → zero-padded sequential number (4 digits)
// "YY"   → 2-digit year suffix

function formatInvoiceNumber(seq: number, year: number, format: string): string
// e.g. formatInvoiceNumber(7, 2026, 'XXXX/YY') → '0007/26'
```

---

## 7. Invoice Template Specification

The PDF template (`InvoiceDocument.tsx`) must be a pixel-faithful replica of the existing Eigensu invoice. Implemented with `@react-pdf/renderer`.

### Brand color tokens

> **Action required:** Before Phase 6 implementation, open the source invoice PDF and sample the exact hex values. Record them here.

| Token | Tailwind name | Usage | Current best-guess (verify!) |
|---|---|---|---|
| Primary brand blue | `eigensu-blue` | UI accents, divider lines | `#86b9d4` |
| Invoice background wash | `eigensu-bg` | PDF page background | `#d6eaf5` |
| Dark text | — | Body copy in PDF | `#1a1a1a` |
| Divider line | — | Horizontal rules in PDF | `#b0cdd9` |

Both `eigensu-blue` and `eigensu-bg` are defined in `packages/config/tailwind.preset.js` and referenced from both the Tailwind theme (UI) and the invoice template (PDF). They are set in one place only.

### Layout (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  BACKGROUND: eigensu-bg (verify against asset)              │
│                                                             │
│  Invoice                      [Date]                        │
│  (72pt bold black)            Invoice No. XXXX/YY           │
│                               (12pt, bold number)           │
├─────────────────────────────────────────────────────────────┤
│  Billed to:                                                 │
│  [Client Name]                                              │
│  [Phone]                                                    │
│  [Billing Address]                                          │
├─────────────────────────────────────────────────────────────┤
│  Description                              Amount            │
├─────────────────────────────────────────────────────────────┤
│  [Line item 1 description]               ₹X,XX,XXX         │
│  [Line item 2 description]               ₹X,XX,XXX         │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  Invoice Amount (In Words):     │  Subtotal    ₹X,XX,XXX   │
│  [Bold words line]              │  Tax (0%)    ₹0           │
│                                 │  Total       ₹X,XX,XXX   │
│                                 │  (bold, larger)           │
├─────────────────────────────────────────────────────────────┤
│  Declaration:                                               │
│  [Declaration text from settings]                           │
├───────────────────────────────┬─────────────────────────────┤
│  Payment Information          │  Eigensu                    │
│  Holder: [name]               │  [Address]                  │
│  A/C: [number]                │  [Phone]                    │
│  IFSC: [code]                 │  [Email]                    │
└───────────────────────────────┴─────────────────────────────┘
```

### Style decisions
- Background: `eigensu-bg` (light wash, see table above — single source of truth)
- "Invoice" header: `#000000`, bold, **72pt** (matches visual prominence in sample)
- Section labels ("Billed to:", "Declaration:", "Payment Information"): bold, 10pt
- Body text: `#1a1a1a`, 10pt
- Dividers: `eigensu-blue`, 1pt
- Font: Helvetica (built-in to @react-pdf — no external download)

---

## 8. API Surface

### Server Actions (all in `apps/web/lib/actions/`)

All follow the same guard pattern:
```typescript
async function someAction(input: unknown) {
  const session = await requireSession()        // throws → redirect to /login
  requireRole(session, ['admin', ...])          // throws → 403
  const data = SomeSchema.parse(input)          // throws ZodError → 400
  // ... DB writes ...
  await writeAuditLog(session.userId, 'ACTION_NAME', 'entity_type', entityId, meta)
  return { success: true, data: ... }
}
```

All errors return `{ success: false, error: string }` to the client — never throw unhandled exceptions.

| Action | Role | Description |
|---|---|---|
| `createClient` | admin, accountant | Insert client row |
| `updateClient` | admin, accountant | Update client fields |
| `archiveClient` | admin | Set status → archived |
| `createProject` | admin, accountant | Insert project + run schedule engine + upsert scheduleItems |
| `updateProject` | admin | Update project + regenerate pending schedule items |
| `createInvoice` | admin, accountant | Atomically allocate invoice number → insert invoice + lineItems + scheduleItem links → render PDF → upload |
| `updateInvoice` | admin, accountant | Update draft invoice fields (re-renders PDF) |
| `sendInvoice` | admin, accountant | Email client with PDF attached, update sentAt + status, write reminder row |
| `recordPayment` | admin, accountant | Insert payment, recompute invoice status + linked schedule item statuses |
| `cancelInvoice` | admin | Set status to cancelled |
| `updateSettings` | admin | Update single settings row |
| `upsertBankAccount` | admin | Create or update bank account; enforce single default |
| `uploadLogo` | admin | Upload image to branding bucket, update settings.logoUrl |
| `upsertReminderRule` | admin | Create or update reminder rule |
| `inviteUser` | admin | Supabase admin invite + insert users row |
| `updateUserRole` | admin | Change role for existing user |
| `revokeUser` | admin | Remove from users table + Supabase deleteUser |

### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/cron/daily` | POST | `Authorization: Bearer ${CRON_SECRET}` | Daily automation (idempotent) |
| `/api/invoices/[id]/pdf` | GET | Session cookie | Stream PDF from Storage via signed URL |

---

## 9. Automation Engine (`/api/cron/daily`)

Runs daily at 08:30 IST (configured as `0 3 * * *` UTC in `vercel.json`). Each step is idempotent. Steps are independent — a failure in one is caught and logged; remaining steps continue.

```
todayIST = toZonedTime(new Date(), 'Asia/Kolkata').date

Step 1: Generate recurring invoices
  For each project where model IN ('subscription', 'upfront_amc'):
    Find scheduleItems where:
      dueDate ≤ todayIST
      AND status = 'pending'
      AND scheduleItemId NOT IN (SELECT scheduleItemId FROM invoiceScheduleItems)
    → createInvoice() for each (auto-numbers via DB sequence)
    → if settings.autoSendRecurring = true, sendInvoice() immediately
    → on any error: log to auditLog, continue to next item

Step 2: Mark overdue (IST-aware)
  UPDATE invoices SET status = 'overdue'
  WHERE status IN ('sent', 'partial') AND dueDate < todayIST

  UPDATE scheduleItems SET status = 'overdue'
  WHERE status = 'pending'
    AND scheduleItemId NOT IN (SELECT scheduleItemId FROM invoiceScheduleItems)
    AND dueDate < todayIST

Step 3: Client reminders
  For each open invoice (status IN 'sent', 'partial', 'overdue'):
    alreadySentRuleIds = SELECT ruleId FROM reminders
                         WHERE invoiceId = invoice.id
                           AND status IN ('sent', 'failed')  // failed counts — won't retry indefinitely
                           AND retryCount >= 3
    firings = core.dueReminders(invoice, rules, todayIST, alreadySentRuleIds)
    For each firing of type 'client_*':
      try:
        INSERT INTO reminders { ruleId, type, invoiceId, status: 'pending', recipients, scheduledFor }
        send email via @eigensu/email
        UPDATE reminders SET status = 'sent', sentAt = now()
      catch error:
        UPDATE reminders SET status = 'failed', error = error.message,
                             retryCount = retryCount + 1
        // Next run: if retryCount < 3, ruleId will not be in alreadySentRuleIds → will retry

Step 4: Internal escalations
  For each firing of type 'internal_alert':
    Same try/catch pattern as Step 3
    Email target: settings.founderEmails

Step 5: Audit log
  INSERT INTO auditLog {
    action: 'CRON_RUN',
    meta: { generated, sentCount, failedCount, overdueFlagged, alertsSent, todayIST }
  }
```

**Retry policy:** A `failed` reminder is retried on subsequent cron runs until `retryCount = 3`, at which point it is excluded from `alreadySentRuleIds` permanently and a manual re-trigger is required. Founders are notified of persistent failures via the internal alert at the same time.

**Per-run cap:** Process a maximum of 50 invoices per step per run to avoid Vercel function timeout. If more are pending, they are processed on subsequent runs. The idempotency guards ensure correctness.

---

## 10. Auth & Security Model

- **Authentication:** Supabase Auth, email/password. No public sign-up. Founders are provisioned (see below) or invited by existing admins.
- **Authorization:** Enforced **entirely at the app layer** via `requireRole()` in Server Actions and middleware. The server uses the Supabase service role key, which bypasses database-level controls. No Row Level Security policies are implemented in v1.
- **Session:** Supabase session cookie, refreshed by Next.js middleware on every request.

**User provisioning flow (seed + first login):**
1. The seed script inserts `users` rows with the founders' emails and role `'admin'`, **with a placeholder UUID** (random).
2. The seed script calls `supabase.auth.admin.inviteUserByEmail()` for each founder email. This creates the Supabase Auth record and sends an invite email.
3. On the invite link, founders set their password.
4. On **first login**, Next.js middleware detects that `auth.uid` does not match any `users.id`. It looks up the `users` row by `email` and updates `id` to match `auth.uid`.
5. Subsequent logins: `auth.uid` matches the `users` row directly.

This flow means the seed script **must** be run with `SUPABASE_SERVICE_ROLE_KEY` set, and founders must accept their invite before the app enforces role checks correctly.

**Authorization levels:**
- `admin` — full access to all actions and admin panel
- `accountant` — can create clients, projects, invoices, record payments; cannot change settings, bank accounts, users, or reminder rules
- `viewer` — read-only; no mutations

**Cron security:** `/api/cron/daily` checks `Authorization: Bearer ${CRON_SECRET}` header; returns 401 if missing or wrong.

**PDF access:** `/api/invoices/[id]/pdf` requires valid session; generates a short-lived (60s) signed URL from Supabase Storage and proxies the response.

**Bank account security (v1):** Account numbers are stored as plaintext in Postgres, protected by:
- Supabase Auth (all API access requires a valid session)
- App-layer role checks (`admin` only for bank account management)
- Supabase service role key is server-only and never exposed to the client
- The UI shows only the last-4 digits in listing views; full number appears only in the bank account edit modal (admin only) and in PDFs sent to the account holder's client

Full encryption-at-rest for account numbers is a v2 item.

**Audit log:** Every mutation writes an `auditLog` row with userId, action name, entity type, entity ID, and a JSON diff/summary.

---

## 11. Environment Variables

```env
# Supabase
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Supabase Storage buckets
SUPABASE_INVOICES_BUCKET=invoices          # PDFs
SUPABASE_BRANDING_BUCKET=branding          # logo (public read)

# Email
RESEND_API_KEY=
EMAIL_FROM="Eigensu <contact@eigensu.in>"

# Automation
CRON_SECRET=                               # random string, ≥32 chars recommended

# App
NEXT_PUBLIC_APP_URL=
APP_TIMEZONE=Asia/Kolkata                  # used for IST-correct "today" in all date math

# Seed
SEED_DEMO=false                            # set true to seed demo client + project
```

---

## 12. Key Design Decisions

### Invoice ↔ Schedule relationship is many-to-many

An invoice can bundle multiple schedule items (e.g., all three installments on one invoice — which is exactly what the Binge Consulting sample shows). A schedule item can appear on at most one invoice (enforced by `UNIQUE` on `invoiceScheduleItems.scheduleItemId`).

When generating an invoice from the project detail page, founders select **one or more** pending schedule items. The invoice line items are pre-populated from those items. Founders may edit line items before saving.

### Payment reconciliation with many-to-many

When a payment is recorded against an invoice:
- If `totalPaid ≥ invoice.total`: invoice status → `paid`; **all** linked schedule items → `paid`
- If `0 < totalPaid < invoice.total`: invoice status → `partial`; linked schedule items remain `pending` until the invoice is fully paid

This is a deliberate simplification: we cannot know which individual schedule item within a bundle is "covered" by a partial payment, so we wait until the invoice clears before marking items paid.

### Invoice number allocation (race-condition-safe)

Invoice numbers are allocated from a Postgres table that acts as a per-year sequence:

```sql
-- Atomic allocation (single round-trip, no race):
INSERT INTO invoice_sequences (year, last_seq) VALUES ($year, 1)
ON CONFLICT (year) DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
RETURNING last_seq;
```

The returned `last_seq` is passed to `core.formatInvoiceNumber(seq, year, format)` to produce the formatted string. The formatted number is then stored in `invoices.invoiceNumber`. This replaces the v1 read-then-increment approach that had a race condition.

### Money handling

Amounts are stored as `numeric(12,2)` in Postgres. All arithmetic in application code uses `toPaise()` → integer math → `fromPaise()` to avoid floating-point drift. `amountToWords()` accepts only whole-rupee integers; the Zod schema on invoice creation rejects any total with paise (i.e. `total % 1 !== 0`).

### Reminder deduplication

The `reminders` table has `UNIQUE (invoiceId, ruleId)`. Before firing, the cron checks `alreadySentRuleIds` — the set of ruleIds with existing reminders for that invoice where either status = `'sent'` or (`status = 'failed'` and `retryCount >= 3`). This means:
- Two rules with the same `type` but different `id` (e.g., the +7d and +15d overdue rules) fire independently.
- A failed reminder is retried up to three times before being permanently skipped.

### Schedule engine idempotency

When a project is edited, `buildSchedule()` is re-run. The caller upserts the result using `(projectId, type, dueDate, label)` as a natural key. Schedule items with status `'paid'` or `'partial'` are never touched — the upsert skips them. Only `'pending'` items may be regenerated.

### PDF generation on server

`@react-pdf/renderer` runs in a Node.js Server Action. The PDF buffer is uploaded to Supabase Storage immediately after invoice creation. The `/api/invoices/[id]/pdf` route generates a short-lived signed URL and proxies the response — PDF is never re-rendered on view.

### Timezone

All "today" computations use IST (`Asia/Kolkata`):
```typescript
import { toZonedTime } from 'date-fns-tz'
const todayIST = toZonedTime(new Date(), process.env.APP_TIMEZONE ?? 'Asia/Kolkata')
```
This is used in the cron, in the overdue marking query, and in the reminder rules engine. The Vercel Cron fires at `0 3 * * *` UTC, which is 08:30 IST — before Eigensu business hours.

### Logo upload

The branding Supabase Storage bucket (`SUPABASE_BRANDING_BUCKET`) is configured with **public read** so the `logoUrl` can be embedded directly in the PDF without generating a signed URL. The `uploadLogo` Server Action uploads the file and updates `settings.logoUrl`.

---

## 13. What Is NOT in Scope for v1

- **GST compliance:** No GSTIN in settings, no CGST/SGST/IGST split, no HSN/SAC codes, no place-of-supply. The current single `tax` field is sufficient for 0% invoices only. A dedicated GST schema migration is required before raising any GST invoice.
- **Encryption at rest for bank account numbers** — listed as v2.
- **Multi-currency** — INR only.
- **Client portal** — no client-facing login.
- **Stripe / payment gateway** — manual payment recording only.
- **Mobile app.**
- **Bulk invoice import.**
- **Custom invoice templates** — one Eigensu template only.
- **Time tracking or project management.**
- **Row Level Security (RLS)** — authorization is app-layer only in v1.

---

## 14. Change Log (v1.0 → v2.0)

| Gap | Change |
|---|---|
| A1: Invoice↔schedule 1:1 | Replaced `invoices.scheduleItemId` and `scheduleItems.generatedInvoiceId` with `invoiceScheduleItems` join table; UNIQUE on scheduleItemId |
| A2: Reminder dedup disables 2nd overdue | Dedup key changed from `(invoiceId, type)` to `(invoiceId, ruleId)`; added `ruleId` FK to `reminders`; added `UNIQUE (invoiceId, ruleId)` |
| A3: Overdue total double-counts | Dashboard overdue card uses `sum(total - payments_received)` not `sum(total)` — see §12 and Implementation §11 |
| A4: Invoice numbering race condition | `core.nextInvoiceNumber()` replaced by atomic DB sequence (`invoiceSequences` table) + `core.formatInvoiceNumber()` for formatting only |
| A5: Failure path undefined | `reminders.retryCount` added; cron wraps each send in try/catch; failed reminders are retried up to 3 times |
| B1: Two different brand blues | Single source of truth in `tailwind.preset.js`; both UI and PDF reference same tokens; both marked "verify against asset" |
| B2: Font size conflict | 72pt is canonical (IMPL Phase 6 updated) |
| B3: `pnpm test` undefined | Added `test` task to `turbo.json`; added `test` script to root `package.json` |
| B4: Money API incomplete | Added `toPaise`, `fromPaise`, `subtractAmounts`; `amountToWords` throws on non-integer; invoice Zod schema rejects paise totals |
| C1: Encryption asserted but unspecified | Plaintext storage acknowledged; encryption listed as v2; security reliance on auth layer documented explicitly |
| C2: Logo upload homeless | Added `SUPABASE_BRANDING_BUCKET`; `uploadLogo` action added; public-read bucket explained |
| C3: Auth UID provisioning undefined | Full first-login UID link flow specified in §10 |
| C4: RLS claimed but not implemented | RLS claim removed from stack table; §10 explicitly states app-layer auth only |
| C5: Cron scalability / plan | Vercel Pro requirement noted; 50-item per-step cap added |
| C6: GST not in scope | Explicitly listed in §13 out-of-scope |
| C7: Timezone ambiguity | `date-fns-tz` added to stack; `APP_TIMEZONE` env var; IST "today" used consistently everywhere; Vercel cron time updated to 08:30 IST |
| #7 (ext): `projects.status` also plain text | Both `clientStatus` and `projectStatus` are now pgEnums |
| #12 (ext): bank account nullable | `invoices.bankAccountId` is NOT NULL; bank account must always be selected |
| autoSend gap | `settings.autoSendRecurring` field added (boolean, default false); replaces undefined `autoSend` from v1 |

---

*End of Technical Specification v2.0*
