import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — Eigensu Billing' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[960px] rounded-[28px] bg-white shadow-[0_8px_40px_rgba(48,52,63,0.14)] overflow-hidden flex flex-col md:flex-row md:min-h-[600px]">

        {/* Left panel — brand */}
        <div className="relative hidden md:flex md:w-[44%] flex-col justify-between bg-navy p-10 overflow-hidden">
          {/* Decorative pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)',
              backgroundSize: '28px 28px, 36px 36px',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-rose/20 blur-3xl"
          />

          {/* Logotype */}
          <div className="relative flex flex-col">
            <span className="font-sans text-2xl font-bold tracking-[0.14em] text-white uppercase">
              EIGENSU
            </span>
            <span className="font-sans text-[11px] font-medium tracking-[0.25em] text-sky-hover uppercase -mt-1">
              BILLING
            </span>
          </div>

          {/* Headline */}
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky mb-3">
              [ Consulting Billing ]
            </p>
            <h2 className="font-display text-[34px] leading-[1.15] font-bold text-white">
              Invoice smarter.
              <br />
              Get paid <span className="text-sky">faster.</span>
            </h2>
            <p className="mt-4 text-sm text-white/60">
              Client billing and receivables, in one place.
            </p>
          </div>

          <p className="relative text-xs text-white/40 font-medium tracking-wide">
            Eigensu · Bengaluru
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 md:px-14">
          <div className="w-full max-w-[380px] mx-auto">
            {/* Mobile logotype */}
            <div className="mb-8 text-center md:hidden">
              <div className="inline-flex flex-col items-center">
                <span className="font-sans text-[24px] font-bold tracking-[0.14em] text-charcoal uppercase">
                  EIGENSU
                </span>
                <span className="font-sans text-[10px] font-medium tracking-[0.25em] text-sky uppercase -mt-1">
                  BILLING
                </span>
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold text-charcoal mb-1">
              Welcome back
            </h1>
            <p className="text-sm text-charcoal-600 mb-7">
              Enter your email and password to access your account.
            </p>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
