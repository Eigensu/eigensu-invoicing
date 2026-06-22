import { db } from '@eigensu/db'
import { auditLog, users } from '@eigensu/db/schema'
import { and, desc, gte, lte, eq, ilike } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { EmptyState } from '@/components/empty-state'

export const metadata = { title: 'Audit Log' }

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; entityType?: string; action?: string }>
}) {
  const session = await requireSession()
  if (!isAdmin(session)) redirect('/dashboard')

  const { from, to, entityType, action } = await searchParams

  const userList = await db
    .select({ id: users.id, name: users.name })
    .from(users)
  const userMap = new Map(userList.map((u) => [u.id, u.name]))

  const logs = await db
    .select()
    .from(auditLog)
    .where(
      and(
        from ? gte(auditLog.createdAt, new Date(from)) : undefined,
        to ? lte(auditLog.createdAt, new Date(`${to}T23:59:59.999Z`)) : undefined,
        entityType ? eq(auditLog.entityType, entityType) : undefined,
        action ? ilike(auditLog.action, `%${action}%`) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          All system events and user actions (last 200 entries)
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3" method="GET">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Entity type</label>
          <input
            type="text"
            name="entityType"
            defaultValue={entityType ?? ''}
            placeholder="e.g. invoice"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Action</label>
          <input
            type="text"
            name="action"
            defaultValue={action ?? ''}
            placeholder="e.g. SEND_INVOICE"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-eigensu-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-eigensu-blue/90"
          >
            Filter
          </button>
          <a
            href="/admin/audit-log"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Clear
          </a>
        </div>
      </form>

      {logs.length === 0 ? (
        <EmptyState heading="No audit log entries found" />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {log.userId ? (userMap.get(log.userId) ?? log.userId.slice(0, 8) + '…') : 'System'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-800">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {log.entityType ? (
                      <span>
                        {log.entityType}
                        {log.entityId && (
                          <span className="ml-1 text-slate-400">
                            /{log.entityId.slice(0, 8)}…
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.meta ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-eigensu-blue hover:underline select-none">
                          View
                        </summary>
                        <pre className="mt-2 max-w-xs overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
