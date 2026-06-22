import { db } from '@eigensu/db'
import { settings } from '@eigensu/db/schema'
import { SettingsForm } from '@/components/admin/settings-form'

export const metadata = { title: 'Admin — Settings' }

export default async function SettingsPage() {
  const [settingsRow] = await db.select().from(settings).limit(1)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          These values appear on invoices and outgoing emails.
        </p>
      </div>
      <SettingsForm settings={settingsRow ?? null} />
    </div>
  )
}
