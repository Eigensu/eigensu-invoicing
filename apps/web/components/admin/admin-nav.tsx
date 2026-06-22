'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Settings',       href: '/admin/settings' },
  { label: 'Bank Accounts',  href: '/admin/bank-accounts' },
  { label: 'Reminder Rules', href: '/admin/reminder-rules' },
  { label: 'Email',          href: '/admin/email' },
  { label: 'Users',          href: '/admin/users' },
  { label: 'Audit Log',      href: '/admin/audit-log' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-white p-1 shadow-[0_2px_12px_rgba(39,52,105,0.08)]">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150',
              active
                ? 'bg-navy text-white shadow-sm'
                : 'text-charcoal-600 hover:bg-navy-muted hover:text-charcoal',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
