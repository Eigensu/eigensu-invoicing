# Deployment Guide — Eigensu Billing

Production stack: **Vercel** (Next.js), **Supabase** (PostgreSQL + Auth), **Resend** (email). No additional servers needed.

---

## 1. Prerequisites

| Service | What you need |
|---|---|
| GitHub | Push the repo to a GitHub account |
| Supabase | Project already created; note the DB URL and keys |
| Resend | API key + a verified sender domain |
| Vercel | Free or Pro account |

---

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create eigensu-billing --private --source=. --push
```

---

## 3. Run DB Migrations Against Production

Point your local `.env` at the **production** Supabase DB URL, then:

```bash
pnpm db:migrate
```

Switch the `.env` back to local when done. Migrations are in `packages/db/drizzle/`.

---

## 4. Configure Supabase Auth for Production

In the **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `https://your-domain.vercel.app`
- **Redirect URLs**: add `https://your-domain.vercel.app/**`

Without this, magic-link / OAuth redirects will fail in production.

---

## 5. Set Up Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo.

2. In the **Configure Project** screen:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js |
   | Root Directory | `.` (monorepo root) |
   | Build Command | `npx turbo build --filter=@eigensu/web` |
   | Output Directory | `apps/web/.next` |
   | Install Command | `pnpm install` |
   | Node.js Version | 20.x |

3. Add all **Environment Variables** (see section 6).

4. Click **Deploy**.

---

## 6. Environment Variables

Add every variable below in Vercel → Settings → Environment Variables (Production + Preview).

```
# Supabase
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key from Supabase API settings]
SUPABASE_SERVICE_ROLE_KEY=[service role key from Supabase API settings]
SUPABASE_INVOICES_BUCKET=invoices
SUPABASE_BRANDING_BUCKET=branding

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=Eigensu Billing <billing@yourdomain.com>

# App
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
APP_TIMEZONE=Asia/Kolkata

# Cron authentication — generate with: openssl rand -hex 32
CRON_SECRET=[random 64-char hex string]
```

**Where to find Supabase values**: Dashboard → Settings → API.

**DATABASE_URL**: use the "Session pooler" or "Direct connection" URL from Supabase → Settings → Database.

---

## 7. Cron Job (Daily Reminders)

`vercel.json` at the repo root already configures the cron:

```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 3 * * *" }
  ]
}
```

This runs at **03:00 UTC (08:30 IST)** every day. The endpoint sends overdue reminders, marks invoices overdue, etc.

Vercel calls the endpoint with `Authorization: Bearer $CRON_SECRET` — make sure that env var is set.

To change the time: edit the `schedule` field (standard cron syntax, UTC).

---

## 8. Custom Domain (Optional)

Vercel → Settings → Domains → Add domain. Update DNS as instructed. After the domain is live, update:

- `NEXT_PUBLIC_APP_URL` in Vercel env vars
- Supabase Auth **Site URL** and **Redirect URLs**

Redeploy after changing env vars.

---

## 9. First-Login Checklist

After deployment, log in and complete setup:

- [ ] **Admin → Settings** — set company name, GST number, invoice number format, default due days, tax %
- [ ] **Admin → Bank Accounts** — add at least one bank account (required before creating invoices)
- [ ] **Admin → Email** — send a test email to verify Resend is working
- [ ] **Admin → Users** — invite your team (accountant, viewer roles)
- [ ] Create your first client, then **New Engagement** to generate a project + invoice in one flow

---

## Redeployment

Every push to `main` auto-deploys on Vercel. To redeploy without a code change:
Vercel Dashboard → Deployments → ⋯ → Redeploy.

To run migrations after a schema change:
```bash
# from monorepo root, with production DATABASE_URL
pnpm db:migrate
```
