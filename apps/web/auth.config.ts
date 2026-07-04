import type { NextAuthConfig } from 'next-auth'

// Edge-safe NextAuth config: everything except the Credentials provider,
// whose `authorize` imports Drizzle/postgres (Node-only). The middleware
// instantiates NextAuth from this config; auth.ts adds the provider.
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
} satisfies NextAuthConfig
