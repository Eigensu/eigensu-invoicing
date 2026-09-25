import { db } from '@eigensu/db'
import { bankAccounts } from '@eigensu/db/schema'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { BankAccountDialog } from '@/components/admin/bank-account-dialog'
import { BankAccountActions } from '@/components/admin/bank-account-actions'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Admin — Bank Accounts' }

export default async function BankAccountsPage() {
  const accounts = await db.select().from(bankAccounts).orderBy(bankAccounts.label)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bank Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Account numbers are masked. Default account is pre-selected on new invoices.
          </p>
        </div>
        <BankAccountDialog>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </BankAccountDialog>
      </div>

      {accounts.length === 0 ? (
        <EmptyState heading="No bank accounts yet." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Account No.</TableHead>
                <TableHead>IFSC</TableHead>
                <TableHead>UPI</TableHead>
                <TableHead>Default</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium text-slate-900">{acc.label}</TableCell>
                  <TableCell className="text-slate-600">{acc.holderName}</TableCell>
                  <TableCell className="font-mono text-sm text-slate-600">
                    ****{acc.accountNumber.slice(-4)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-slate-600">{acc.ifsc}</TableCell>
                  <TableCell className="text-slate-500">{acc.upiId ?? '—'}</TableCell>
                  <TableCell>
                    {acc.isDefault && <Badge variant="success">Default</Badge>}
                  </TableCell>
                  <TableCell>
                    <BankAccountActions account={acc} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
