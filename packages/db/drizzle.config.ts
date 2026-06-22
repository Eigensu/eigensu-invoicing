import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

// drizzle-kit runs with CWD = packages/db/, so ../../ reaches the monorepo root
config({ path: '../../.env' })

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
} satisfies Config
