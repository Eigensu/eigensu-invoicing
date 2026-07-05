# Eigensu Billing — User Guide

Everything you need to use the app end-to-end: what each page does, how to onboard clients, create invoices, record payments, manage reminders, and read the audit log.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Navigation](#2-navigation)
3. [Dashboard](#3-dashboard)
4. [Clients](#4-clients)
5. [Projects](#5-projects)
6. [Invoices](#6-invoices)
7. [Payments](#7-payments)
8. [Reminders](#8-reminders)
9. [Admin — Settings](#9-admin--settings)
10. [Admin — Bank Accounts](#10-admin--bank-accounts)
11. [Admin — Reminder Rules](#11-admin--reminder-rules)
12. [Admin — Email](#12-admin--email)
13. [Admin — Users](#13-admin--users)
14. [Admin — Audit Log](#14-admin--audit-log)
15. [End-to-End: Onboarding a New Client](#15-end-to-end-onboarding-a-new-client)
16. [End-to-End: Creating and Sending an Invoice](#16-end-to-end-creating-and-sending-an-invoice)
17. [End-to-End: Recording a Payment](#17-end-to-end-recording-a-payment)
18. [How Automated Reminders Work](#18-how-automated-reminders-work)
19. [Roles and Permissions](#19-roles-and-permissions)

---

## 1. Logging In

**URL:** `http://localhost:3000/login` (dev) or your production URL.

- Enter your email and password, then click **Sign in**.
- You are redirected to `/dashboard` on success.
- If you forget your password: ask an admin to send you a fresh invite (Admin → Users), which emails a new set-password link. Founders can also re-run the seed against a fresh account or set a password hash directly in the database.

---

## 2. Navigation

The left sidebar has these sections:

| Link | Path | Who can see |
|---|---|---|
| Dashboard | `/dashboard` | Everyone |
| Clients | `/clients` | Everyone |
| Projects | `/projects` | Everyone |
| Invoices | `/invoices` | Everyone |
| Payments | `/payments` | Everyone |
| Reminders | `/reminders` | Everyone |
| Admin | `/admin/...` | Admin only |

Admins see an **Admin** section in the sidebar with sub-pages: Settings, Bank Accounts, Reminder Rules, Email, Users, Audit Log.

---

## 3. Dashboard

**Path:** `/dashboard`

Your financial command centre. Shows four summary cards at the top:

| Card | What it counts |
|---|---|
| **Total Billed** | Sum of all non-cancelled invoices (including drafts) |
| **Total Received** | Sum of all payments recorded across all invoices |
| **Outstanding** | Remaining unpaid amount across all unpaid invoices (net of partial payments) |
| **Overdue** | Outstanding amount on invoices whose due date has passed |

Below the cards:

- **Monthly Billing vs Payments chart** — bar chart for the last 12 months. Blue = invoiced, green = received. Use this to spot months where cash collection lagged behind invoicing.
- **Outstanding by Client chart** — horizontal bars showing which clients owe the most right now.
- **Due This Month** — table of invoices whose due date falls within the current calendar month, not yet paid. Columns: invoice number, client, due date, amount, status.
- **Overdue** — invoices past their due date. Shows days overdue and outstanding amount. Has a **Send Reminder** button per row (Admin/Accountant only) to fire an ad-hoc reminder email to the client immediately.

Everything on the dashboard is read-only. Click any invoice number or client name to navigate to that record.

---

## 4. Clients

### `/clients` — Client list

Shows all active clients by default. Controls:

- **Search box** — filters by client name (case-insensitive).
- **Status toggle** — switch between Active and Archived clients.
- **+ Add Client** button (Admin/Accountant only) — opens the **Add Client** dialog.

**Add Client dialog fields:**

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Company or person name |
| Email | Yes | Used for invoice emails and reminder emails |
| Contact Person | No | Name of the person who handles billing |
| Phone | No | Stored, shown on client profile |
| Billing Address | No | Multi-line; appears on invoices |
| GST ID | No | Client's GSTIN; appears on invoices if filled |
| Notes | No | Internal notes; not shown on invoices |

After saving, the client appears in the list immediately.

### `/clients/[id]` — Client profile

Three tabs:

- **Info** — all the fields you entered (name, email, contact person, phone, billing address, GST ID, notes). Edit button opens the same dialog pre-filled.
- **Projects** — all projects linked to this client. Each card shows the project name, payment model, and how many schedule items are pending vs total. Click any project to open it. "Create Project" shortcut takes you to the new-project wizard pre-filled with this client.
- **Invoices** — every invoice ever raised for this client, newest first. Shows invoice number, due date, total, and status badge. Click to open the invoice.

---

## 5. Projects

### `/projects` — Project list

Shows active projects by default. Filter by:
- **Client** — shows only projects for a specific client.
- **Status** — Active / Completed / Archived.

Click **New Project** to open the project wizard.

### `/projects/new` — New Project wizard

Step 1: fill in project details.

| Field | Required | Notes |
|---|---|---|
| Client | Yes | Select from active clients |
| Project Name | Yes | e.g. "Recruitr Platform Build" |
| Description | No | Internal description |
| Payment Model | Yes | One-Time / Installments / Subscription / Upfront + AMC |
| Total Value | Yes | Full contract value in ₹ |
| Start Date | Yes | When work began |
| End Date | No | Optional completion date |
| AMC Amount | If Upfront + AMC | Annual maintenance amount |
| AMC Recurrence | If Upfront + AMC | Monthly / Quarterly / Yearly |

Step 2 (schedule): add one or more payment milestones.

| Field | Notes |
|---|---|
| Label | What this payment covers, e.g. "2nd Installment — Development" |
| Amount | Amount for this milestone in ₹ |
| Due Date | When this milestone is due |
| Type | Installment / Milestone / Subscription / AMC |
| Recurrence | For subscriptions/AMC: Monthly / Quarterly / Yearly / None |

Add as many schedule items as the contract requires. Save — the project is created with all items pending.

### `/projects/[id]` — Project detail

Shows project metadata (client, total value, start/end dates, payment model) and a **Payment Schedule** table.

Schedule table columns:
- **Label** — milestone name
- **Due Date** — when it falls due
- **Amount** — milestone value in ₹
- **Type** — installment / subscription / etc.
- **Status** — Pending / Invoiced / Paid
- **Invoice** — if an invoice exists for this milestone, shows the invoice number as a link
- **Actions** — **Generate Invoice** button (if no invoice yet and you have write access)

Clicking **Generate Invoice** on a schedule item takes you to `/invoices/new` pre-filled with that milestone's details (client, amount, label as line item description).

---

## 6. Invoices

### `/invoices` — Invoice list

All invoices, newest first. Status filter tabs at the top: All / Draft / Sent / Partial / Paid / Overdue / Cancelled.

Click **New Invoice** to create a standalone invoice (not tied to a schedule item).

**Invoice statuses explained:**

| Status | Meaning |
|---|---|
| **Draft** | Created but not yet sent to client |
| **Sent** | Email sent to client |
| **Partial** | Payment received but less than the full amount |
| **Paid** | Fully paid |
| **Overdue** | Due date passed and not fully paid |
| **Cancelled** | Voided — excluded from all financial totals |

### `/invoices/new` — New Invoice form

| Field | Required | Notes |
|---|---|---|
| Client | Yes | Select active client — determines where email goes |
| Project | No | Links the invoice to a project (optional) |
| Issue Date | Yes | Defaults to today |
| Due Date | Yes | Defaults to today + your default due-days setting |
| Bank Account | Yes | Pre-selects your default account |
| Tax % | Yes | Defaults to your global setting (e.g. 18% GST) |
| Line Items | Yes | At least one. Each has a Description and Amount |

You can add multiple line items (+ Add Item). The subtotal, tax, and total are calculated automatically.

When you save: the invoice is created as **Draft** with an auto-generated invoice number (e.g. `0001/25`).

### `/invoices/[id]` — Invoice detail

Shows full invoice data plus:

**Action buttons (top right):**

| Button | Who | What it does |
|---|---|---|
| **PDF** | Everyone | Opens a download/preview of the PDF in a new tab |
| **Send Invoice** | Admin/Accountant | Emails the PDF to the client; moves status to Sent |
| **Send Reminder** | Admin/Accountant | Re-sends the invoice email as a payment reminder |
| **Cancel** | Admin/Accountant | Cancels a draft invoice (irreversible) |
| **Record Payment** | Admin/Accountant | Opens the payment dialog |

**Line Items section** — all line items with amounts, subtotal, tax, and total.

**Payments section** — appears only if at least one payment has been recorded. Shows date, mode, reference, and amount for each payment.

**PDF Preview** — inline render of what the client receives. This is exactly what gets attached to the email.

---

## 7. Payments

**Path:** `/payments`

A global ledger of every payment received, across all invoices and clients. Newest first.

Columns: Date, Invoice #, Client, Amount, Mode (bank transfer / UPI / cheque / cash / other), Reference (e.g. UTR number), Notes.

You cannot add payments from this page. Payments are recorded from the **Invoice detail page** using the **Record Payment** button.

**Record Payment dialog (opened from invoice detail):**

| Field | Required | Notes |
|---|---|---|
| Amount | Yes | Must be ≤ outstanding balance |
| Date Received | Yes | The actual date money arrived |
| Mode | Yes | Bank Transfer / UPI / Cheque / Cash / Other |
| Reference | No | UTR number, cheque number, UPI transaction ID |
| Notes | No | Any internal notes |

After saving:
- If the payment equals the outstanding balance → invoice moves to **Paid**, linked schedule items move to **Paid**.
- If less than outstanding → invoice moves to **Partial**.

---

## 8. Reminders

**Path:** `/reminders`

A log of every automated and manual reminder email the system has sent or attempted to send.

Filter by status: All / Pending / Sent / Failed / Skipped.

Columns:

| Column | Notes |
|---|---|
| Date | When the reminder was sent (or scheduled date if still pending) |
| Type | Due Soon / Due Today / Overdue / Internal Alert |
| Invoice | Links to the invoice |
| Client | Links to the client |
| Recipients | Email addresses the reminder went to |
| Status | Sent / Failed / Skipped / Pending |
| Retries | How many times the system retried on failure |

**What triggers entries here:** the daily cron job (`/api/cron/daily`) runs once per day and evaluates all active reminder rules against every unpaid invoice. When it decides to send, it creates a record here and fires the email. You can also trigger ad-hoc reminders from the Dashboard's Overdue table.

---

## 9. Admin — Settings

**Path:** `/admin/settings`

Controls what appears on every invoice and outgoing email.

| Field | Notes |
|---|---|
| Company Name | Appears in email subject lines and invoice header |
| Company Address | Printed on every invoice |
| Company Phone | Printed on every invoice |
| Company Email | Reply-to address on outgoing emails |
| Logo URL | Optional — URL of your company logo for invoice header |
| Default Tax % | Pre-fills the tax field on new invoices (e.g. 18 for GST) |
| Default Currency | INR (only INR supported currently) |
| Invoice Number Format | `XXXX/YY` = sequential number / 2-digit year |
| Default Due Days | How many days after issue date the due date defaults to |
| Declaration Text | Legal declaration printed at the bottom of every invoice |
| Founder Emails | List of emails that receive CC on overdue internal alerts and certain reminders |
| Auto-Send Recurring | If on, recurring invoices generated by cron are emailed automatically without manual review |

Changes take effect immediately on the next invoice generated or email sent.

---

## 10. Admin — Bank Accounts

**Path:** `/admin/bank-accounts`

Manage the bank accounts printed on invoices for client payment.

Each account has: Label (internal name), Account Holder Name, Account Number (stored in full, displayed masked as `****1234`), IFSC code, UPI ID, and a Default flag.

- The **default** account is pre-selected on every new invoice form.
- You can have multiple accounts (e.g. separate accounts per project type or for different team members) and choose at invoice-creation time which one to use.
- Click **Add Account** to add a new one.
- Each row has an edit (pencil) and delete (bin) button. You cannot delete an account linked to existing invoices.

---

## 11. Admin — Reminder Rules

**Path:** `/admin/reminder-rules`

Controls exactly when and what reminder emails get sent. The seed pre-populates five rules:

| # | Type | Offset | What it does |
|---|---|---|---|
| 1 | Due Soon | −7 days | Sent to client 7 days before due date |
| 2 | Due Today | 0 days | Sent to client on the due date |
| 3 | Overdue | +7 days | Sent to client when invoice is 7 days overdue |
| 4 | Overdue | +15 days | Second overdue notice, CC founders |
| 5 | Internal Alert | +30 days | Sent only to founders when invoice is 30 days overdue |

Each rule has:

| Field | Notes |
|---|---|
| Type | `client_due_soon` / `client_due` / `client_overdue` / `internal_alert` |
| Offset Days | Negative = before due date, positive = days overdue |
| Subject | Email subject line. Supports `{{placeholders}}` |
| Body Template | Email body. Supports `{{placeholders}}` |
| CC Founders | If on, founder emails (from Settings) are CC'd |
| Enabled | Toggle to disable a rule without deleting it |

**Placeholders you can use in subject and body:**

```
{{clientName}}       — client company name
{{invoiceNumber}}    — e.g. 0001/25
{{amount}}           — invoice total
{{outstanding}}      — amount still unpaid
{{dueDate}}          — due date formatted
{{daysUntilDue}}     — days until due (for due-soon type)
{{daysOverdue}}      — days past due (for overdue type)
{{companyName}}      — your company name (from Settings)
{{companyEmail}}     — your company email (from Settings)
{{companyPhone}}     — your company phone (from Settings)
{{overdueCount}}     — number of overdue invoices (for internal_alert type)
{{totalOutstanding}} — total outstanding across all overdue invoices
{{invoiceRows}}      — formatted list of overdue invoices (internal_alert only)
```

You can edit the subject and body template of any rule inline. Click the pencil icon on a row to expand an edit form.

---

## 12. Admin — Email

**Path:** `/admin/email`

Read-only status page showing:

- **From address** — what clients see in their inbox as the sender (`Eigensu <billing@eigensu.in>`). Controlled by the `EMAIL_FROM` environment variable.
- **Founder alert recipients** — the emails from Settings → Founder Emails. Internal alert reminders (overdue 30+ days) go here. Edit by going to Settings.
- **Send Test Email** — fires a test email to your own logged-in account email. Use this to verify Resend is configured and emails are delivering.

All emails go through **Resend** (configured via `RESEND_API_KEY` env var). The sending domain must be verified in Resend for emails to not land in spam.

---

## 13. Admin — Users

**Path:** `/admin/users`

Manage who can log in and what they can do.

**Roles:**

| Role | What they can do |
|---|---|
| **Admin** | Full access — everything including Admin section, invite/remove users, change roles |
| **Accountant** | Create/edit clients, projects, invoices, record payments, send reminders. Cannot access Admin section |
| **Viewer** | Read-only — can see everything but cannot create, edit, or send anything |

**Inviting a new user:**
1. Click **Invite User**.
2. Enter their name, email, and assign a role.
3. They receive an invite email with a link to set their password.
4. The link is valid for 7 days; once they set a password they can log in immediately.

**Changing a role:** click the kebab menu (⋯) on any user row → **Change Role**. You cannot demote yourself.

**Removing a user:** kebab menu → **Revoke**. This deactivates their account — they can no longer sign in, but their audit history is preserved. You cannot revoke yourself.

---

## 14. Admin — Audit Log

**Path:** `/admin/audit-log`

A tamper-evident log of every significant action taken in the system (last 200 entries).

**Columns:** Timestamp (IST), User (name or "System" for automated actions), Action (e.g. `CREATE_INVOICE`, `SEND_INVOICE`, `RECORD_PAYMENT`), Entity type + ID, and a **View** link to see the JSON metadata payload.

**Filters:**
- **From / To** — date range
- **Entity type** — e.g. `invoice`, `client`, `payment`
- **Action** — partial text match, e.g. type `SEND` to find all send actions

Common action strings you'll see:

| Action | Triggered by |
|---|---|
| `CREATE_CLIENT` | Adding a new client |
| `UPDATE_CLIENT` | Editing client details |
| `CREATE_PROJECT` | New project wizard |
| `CREATE_INVOICE` | Saving the invoice form |
| `SEND_INVOICE` | Clicking Send Invoice |
| `CANCEL_INVOICE` | Clicking Cancel on a draft |
| `RECORD_PAYMENT` | Recording a payment |
| `SEND_REMINDER` | Manual or automated reminder sent |
| `CREATE_REMINDER_RULE` | Adding a reminder rule |
| `UPDATE_SETTINGS` | Saving company settings |
| `INVITE_USER` | Inviting a new user |
| `UPDATE_USER_ROLE` | Changing someone's role |
| `CRON_DAILY` | Daily cron job ran |
| `AUTO_SEND_INVOICE` | Recurring invoice auto-emailed by cron |

Audit log entries are written automatically — you never need to do anything manually.

---

## 15. End-to-End: Onboarding a New Client

**Scenario:** You've just signed a new client — Acme Corp — for a web platform build.

1. Go to **Clients** → click **+ Add Client**.
2. Fill in:
   - Name: `Acme Corp`
   - Email: `billing@acmecorp.com` ← this is where all invoice and reminder emails go
   - Contact Person: `Priya Sharma`
   - Phone: `+91 99999 11111`
   - Billing Address: `123 MG Road, Bengaluru, Karnataka 560001`
   - GST ID: `29AABCC1234F1Z5` (if they have one)
3. Click **Save**. Client appears in the list.

4. Click **Acme Corp** to open the profile → **Projects** tab → **Create Project**.
5. In the wizard:
   - Client: `Acme Corp` (pre-filled)
   - Name: `Acme Web Platform`
   - Payment Model: `Installments`
   - Total Value: `500000`
   - Start Date: today
6. Add schedule items:
   - `Design & Discovery` — ₹1,00,000 — due in 30 days
   - `Development Phase 1` — ₹2,00,000 — due in 90 days
   - `Development Phase 2` — ₹1,50,000 — due in 150 days
   - `Launch & Handover` — ₹50,000 — due in 180 days
7. Click **Save Project**. The project is created with all four milestones as **Pending**.

Client is now fully onboarded. The payment schedule is set up and ready to invoice against.

---

## 16. End-to-End: Creating and Sending an Invoice

**Scenario:** The design phase is complete. Time to send Acme Corp the first invoice.

**Option A — from the project schedule (recommended):**
1. Go to **Projects** → click **Acme Web Platform**.
2. In the Payment Schedule table, find `Design & Discovery`.
3. Click **Generate Invoice** on that row.
4. You land on `/invoices/new` pre-filled with: client = Acme Corp, line item = "Design & Discovery" at ₹1,00,000, tax at 18% (₹18,000), total ₹1,18,000.
5. Adjust the due date if needed. Pick the bank account.
6. Click **Save** → invoice `0001/25` is created as **Draft**.

**Option B — standalone invoice:**
1. Go to **Invoices** → **New Invoice**.
2. Manually select client, enter line items, dates, bank account.

**To send the invoice:**
1. Open the invoice (e.g. `/invoices/[id]`).
2. Click **PDF** (top right) to preview what the client will receive.
3. When satisfied, click **Send Invoice**.
4. The system emails the PDF to `billing@acmecorp.com` with the subject `Invoice 0001/25 from Eigensu`.
5. Status changes from **Draft** → **Sent**.
6. The schedule item linked to this invoice changes from **Pending** → **Invoiced**.

---

## 17. End-to-End: Recording a Payment

**Scenario:** Acme Corp pays ₹1,18,000 on 25 June 2025 via bank transfer, UTR `HDFC25062025001`.

1. Open the invoice (`/invoices/[id]` for invoice `0001/25`).
2. Click **Record Payment**.
3. Fill in:
   - Amount: `118000`
   - Date Received: `2025-06-25`
   - Mode: `Bank Transfer`
   - Reference: `HDFC25062025001`
   - Notes: (optional)
4. Click **Save**.
5. Invoice status changes to **Paid**. The linked schedule item changes to **Paid**.
6. The Dashboard's Outstanding and Overdue cards update immediately.
7. A `RECORD_PAYMENT` entry appears in the Audit Log.

If Acme Corp pays only ₹50,000 first:
- Enter `50000` in the amount field.
- Invoice moves to **Partial** (not Paid).
- Outstanding shows ₹68,000 remaining.
- When the remaining ₹68,000 comes in, record a second payment — invoice moves to **Paid**.

---

## 18. How Automated Reminders Work

The system runs a **daily cron job** at a scheduled time (configured via Vercel Cron or external scheduler) that hits `/api/cron/daily` with the `CRON_SECRET` header.

Each run:
1. Marks any sent/partial invoices whose due date has passed as **Overdue**.
2. Generates recurring invoices from subscription/AMC schedule items that are due.
3. Evaluates every active reminder rule against every unpaid invoice.
4. For each invoice × rule combination that matches today's date, fires an email and logs it in the Reminders table.

**Which email address receives reminders?**
- **Client reminders** (`client_due_soon`, `client_due`, `client_overdue`) → sent to the client's email address (the one on the Client record).
- **Internal alerts** (`internal_alert`) → sent to Founder Emails (configured in Admin → Settings).
- **CC Founders** toggle → if on for a rule, founder emails are CC'd on client-facing reminders too.

**To test reminders manually:**
- From the Dashboard Overdue table, click **Send Reminder** on any overdue invoice.
- This fires the most appropriate overdue reminder rule immediately, regardless of whether the cron has run.

**To temporarily disable a reminder:**
- Go to **Admin → Reminder Rules** → find the rule → toggle **Enabled** off.

---

## 19. Roles and Permissions

| Action | Admin | Accountant | Viewer |
|---|---|---|---|
| View dashboard, clients, projects, invoices, payments, reminders | ✅ | ✅ | ✅ |
| Create/edit clients | ✅ | ✅ | — |
| Create/edit projects | ✅ | ✅ | — |
| Create invoices | ✅ | ✅ | — |
| Send invoices / reminders | ✅ | ✅ | — |
| Cancel invoices | ✅ | ✅ | — |
| Record payments | ✅ | ✅ | — |
| Access Admin section | ✅ | — | — |
| Manage company settings | ✅ | — | — |
| Manage bank accounts | ✅ | — | — |
| Manage reminder rules | ✅ | — | — |
| Invite / remove users | ✅ | — | — |
| View audit log | ✅ | — | — |

Viewers are useful for accountants or stakeholders who need to see the numbers but should not be able to modify anything. Accountants handle day-to-day billing but cannot touch system configuration.
