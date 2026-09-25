import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'

// No database adapter — the Drizzle `users` table is the sole source of truth.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === 'string' ? credentials.email.toLowerCase() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) return null

        const user = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (!user || !user.passwordHash || !user.isActive) return null

        const valid = await compare(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Invite-only: a Google account can only sign in if its email already
    // has an active row in `users` (created by an admin). Reject everyone
    // else, and remap the session to our internal user id rather than
    // Google's own profile id.
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true

      const email = user.email?.toLowerCase()
      if (!email) return false

      const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
      if (!existing || !existing.isActive) return false

      user.id = existing.id
      return true
    },
  },
})
