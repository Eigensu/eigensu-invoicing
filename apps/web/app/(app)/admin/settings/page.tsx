import { db } from '@eigensu/db'
import { settings, canvaConnection } from '@eigensu/db/schema'
import { SettingsForm } from '@/components/admin/settings-form'
import { CanvaIntegrationCard } from '@/components/admin/canva-integration-card'

export const metadata = { title: 'Admin — Settings' }

export default async function SettingsPage() {
  const [settingsRow] = await db.select().from(settings).limit(1)

  // Non-fatal: if the canva_connection table/migration isn't in place yet,
  // the rest of the Settings page should still render.
  let canvaRow: typeof canvaConnection.$inferSelect | undefined
  try {
    ;[canvaRow] = await db.select().from(canvaConnection).limit(1)
  } catch (err) {
    console.error('Failed to load Canva connection status:', err)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          These values appear on invoices and outgoing emails.
        </p>
      </div>
      <SettingsForm settings={settingsRow ?? null} />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
      </div>
      <CanvaIntegrationCard
        connected={!!canvaRow}
        {...(canvaRow ? { brandTemplateId: canvaRow.brandTemplateId } : {})}
      />
    </div>
  )
}
