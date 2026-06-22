# Eigensu Billing

Internal invoice and receivables management for Eigensu consulting.

## First-time setup

1. Create a Supabase project (Postgres + Auth + Storage)
2. Create two Storage buckets: `invoices` (private) and `branding` (public)
3. Sign up for Resend and get an API key
4. Deploy to Vercel (Pro plan required for Cron)
5. Clone this repo and run:

   ```
   cp .env.example .env
   # Fill all values in .env
   pnpm install
   pnpm db:generate && pnpm db:migrate
   pnpm --filter @eigensu/db seed          # sends founder invite emails
   ```

6. Founders accept invite emails and set passwords
7. `pnpm dev` (local) or deploy to Vercel

## Key commands

```
pnpm dev            # start local dev server
pnpm build          # production build
pnpm lint           # ESLint check
pnpm type-check     # TypeScript check
pnpm test           # run Vitest unit tests
pnpm db:generate    # generate Drizzle migrations from schema changes
pnpm db:migrate     # apply pending migrations
```

## Cron

Vercel Cron fires daily at 08:30 IST (configured in `vercel.json`).
To test locally: `POST /api/cron/daily` with `Authorization: Bearer <CRON_SECRET>`
