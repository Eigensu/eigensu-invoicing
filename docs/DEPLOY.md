# Deployment Guide — Eigensu Billing

Production stack: **Vercel** (Next.js), **Railway** (PostgreSQL), **NextAuth** (credentials auth), **Cloudinary** (logo storage), **Resend** (email). No additional servers needed.

---

## 1. Prerequisites

| Service | What you need |
|---|---|
| GitHub | Push the repo to a GitHub account |
| Railway | A Postgres database; note the public connection URL |
| Cloudinary | Free account; note cloud name, API key, API secret |
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

## 3. Set Up the Database (Railway)

Fresh setup: create a Railway Postgres service, copy its **public** connection
URL into `DATABASE_URL` in your local `.env`, then from the monorepo root:

```bash
pnpm db:migrate                  # applies all migrations in packages/db/migrations/
pnpm --filter @eigensu/db seed   # idempotent: settings, reminder rules, bank account, founders
```

The seed prints a set-password URL for each founder (or seeds a password
directly when `SEED_FOUNDER_PASSWORD` is set). Running the seed again is a
no-op. Switch the `.env` back to local values when done.

---

## 4. Auth Configuration

Auth is NextAuth (credentials + JWT sessions) — there is no external auth
service to configure. Just make sure `AUTH_SECRET` is set in every
environment (generate with `openssl rand -base64 32`). If you deploy
somewhere other than Vercel, also set `AUTH_TRUST_HOST=true`.

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
# Database (Railway)
DATABASE_URL=postgresql://postgres:[password]@[host].proxy.rlwy.net:[port]/railway

# Auth (NextAuth) — generate with: openssl rand -base64 32
AUTH_SECRET=[random secret]

# Cloudinary
CLOUDINARY_CLOUD_NAME=[cloud name]
CLOUDINARY_API_KEY=[api key]
CLOUDINARY_API_SECRET=[api secret]

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=Eigensu Billing <billing@yourdomain.com>

# App
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
APP_TIMEZONE=Asia/Kolkata

# Cron authentication — generate with: openssl rand -hex 32
CRON_SECRET=[random 64-char hex string]
```

**DATABASE_URL**: Railway → your Postgres service → Connect → public network URL.

**Cloudinary values**: Cloudinary console → Dashboard → API keys.

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
