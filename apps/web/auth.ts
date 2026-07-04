import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
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
  ],
})
