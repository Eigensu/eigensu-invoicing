import { db } from '@eigensu/db'
import { settings } from '@eigensu/db/schema'
import { SendTestEmailButton } from '@/components/admin/send-test-email-button'

export const metadata = { title: 'Admin — Email' }

export default async function EmailPage() {
  const [settingsRow] = await db.select().from(settings).limit(1)
  const emailFrom = process.env['EMAIL_FROM'] ?? '(not configured — set EMAIL_FROM env var)'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Email Configuration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Email is sent via Resend. Configure RESEND_API_KEY and EMAIL_FROM as environment
          variables.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700">From address</p>
            <p className="mt-0.5 text-xs text-slate-500">Set via EMAIL_FROM environment variable</p>
          </div>
          <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{emailFrom}</code>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Founder alert recipients</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Edit in <a href="/admin/settings" className="text-eigensu-blue hover:underline">Settings → Founder Emails</a>
            </p>
          </div>
          <div className="text-right">
            {settingsRow && settingsRow.founderEmails.length > 0 ? (
              <ul className="space-y-1">
                {settingsRow.founderEmails.map((e) => (
                  <li key={e} className="text-xs text-slate-600">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400">None configured</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Send test email</p>
            <p className="mt-0.5 text-xs text-slate-500">Sends to your account email to verify delivery</p>
          </div>
          <SendTestEmailButton />
        </div>
      </div>
    </div>
  )
}
