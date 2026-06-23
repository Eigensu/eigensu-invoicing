import Link from 'next/link'
import { Plus } from 'lucide-react'
import { RecordsNav } from '@/components/records/records-nav'

export const metadata = { title: 'Records' }

export default function RecordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">Records</h1>
          <p className="mt-1 text-sm text-charcoal-600">
            Clients, projects, invoices and payments — all in one place.
          </p>
        </div>
        <Link
          href="/engagements/new"
          className="flex items-center gap-2 rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky/90"
        >
          <Plus className="h-4 w-4" />
          New Engagement
        </Link>
      </div>

      <div className="flex justify-center">
        <RecordsNav />
      </div>

      <div>{children}</div>
    </div>
  )
}
