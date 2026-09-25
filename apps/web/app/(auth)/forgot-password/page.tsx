import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Forgot password — Eigensu Billing' }

export default async function ForgotPasswordPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl bg-white px-8 py-8 shadow-[0_4px_24px_rgba(48,52,63,0.10)]">
          <h1 className="font-display text-2xl font-bold text-charcoal mb-1">
            Reset your password
          </h1>
          <p className="text-sm text-charcoal-600 mb-6">
            Enter your account email and we&apos;ll send you a link to set a new password.
          </p>
          <ForgotPasswordForm />
          <Link
            href="/login"
            className="mt-6 block text-center text-sm font-medium text-navy hover:text-navy-hover"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
