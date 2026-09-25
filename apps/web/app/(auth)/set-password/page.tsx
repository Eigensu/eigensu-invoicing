import { SetPasswordForm } from './set-password-form'

export const metadata = { title: 'Set password — Eigensu Billing' }

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

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
          {token ? (
            <>
              <h1 className="font-display text-2xl font-bold text-charcoal mb-1">
                Set your password
              </h1>
              <p className="text-sm text-charcoal-600 mb-6">
                Choose a password to activate your account.
              </p>
              <SetPasswordForm token={token} />
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-charcoal mb-1">
                Invalid link
              </h1>
              <p className="text-sm text-charcoal-600">
                This invite link is invalid or has expired. Please ask an administrator to send
                you a new invitation.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
