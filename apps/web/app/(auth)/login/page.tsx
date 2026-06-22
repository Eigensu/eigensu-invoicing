import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — Eigensu Billing' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">

        {/* Logotype */}
        <div className="mb-8 text-center">
          <div className="inline-flex flex-col items-center">
            <span className="font-sans text-[28px] font-bold tracking-[0.14em] text-charcoal uppercase">
              EIGENSU
            </span>
            <span className="font-sans text-[11px] font-medium tracking-[0.25em] text-sky uppercase -mt-1">
              BILLING
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white px-8 py-8 shadow-[0_4px_24px_rgba(48,52,63,0.10)]">
          <h1 className="font-display text-2xl font-bold text-charcoal mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-charcoal-600 mb-6">
            Sign in to your account to continue.
          </p>
          <LoginForm />
        </div>

        {/* Footer tagline */}
        <p className="mt-6 text-center text-xs text-rose font-medium tracking-wide">
          Eigensu · Bengaluru
        </p>
      </div>
    </div>
  )
}
