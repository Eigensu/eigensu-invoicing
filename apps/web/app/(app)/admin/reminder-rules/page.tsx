import { db } from '@eigensu/db'
import { reminderRules } from '@eigensu/db/schema'
import { ReminderRuleRow } from '@/components/admin/reminder-rule-row'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Admin — Reminder Rules' }

const TYPE_LABEL: Record<string, string> = {
  client_due_soon: 'Due Soon',
  client_due: 'Due Today',
  client_overdue: 'Overdue',
  internal_alert: 'Internal Alert',
}

export default async function ReminderRulesPage() {
  const rules = await db
    .select()
    .from(reminderRules)
    .orderBy(reminderRules.sortOrder, reminderRules.offsetDays)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reminder Rules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Templates support <code className="rounded bg-slate-100 px-1 text-xs">{'{{varName}}'}</code>{' '}
          placeholders: clientName, invoiceNumber, amount, outstanding, dueDate, daysUntilDue,
          daysOverdue, companyName, companyEmail, companyPhone.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Offset (days)</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>CC Founders</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <ReminderRuleRow
                key={rule.id}
                rule={rule}
                typeLabel={TYPE_LABEL[rule.type] ?? rule.type}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
