'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createInvoice } from '@/lib/actions/invoices'
import type { BankAccount } from '@eigensu/db'

interface ScheduleItemSeed {
  id: string
  label: string
  amount: number
  clientId: string
}

interface LineItemRow {
  description: string
  amount: string
}

interface Props {
  preloadedScheduleItems: ScheduleItemSeed[]
  preselectedClientId?: string
  preselectedProjectId?: string
  clients: Array<{ id: string; name: string }>
  bankAccounts: BankAccount[]
  defaultBankAccountId: string
  defaultTaxPercent: number
  defaultIssueDate: string
  defaultDueDate: string
}

export function InvoiceForm({
  preloadedScheduleItems,
  preselectedClientId,
  preselectedProjectId,
  clients,
  bankAccounts,
  defaultBankAccountId,
  defaultTaxPercent,
  defaultIssueDate,
  defaultDueDate,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const lockedClientId =
    preselectedClientId ?? preloadedScheduleItems[0]?.clientId

  const [selectedClientId, setSelectedClientId] = useState(lockedClientId ?? '')

  const [lineItems, setLineItems] = useState<LineItemRow[]>(
    preloadedScheduleItems.length > 0
      ? preloadedScheduleItems.map((si) => ({
          description: si.label,
          amount: String(si.amount),
        }))
      : [{ description: '', amount: '' }],
  )
  const [issueDate, setIssueDate] = useState(defaultIssueDate)
  const [dueDate, setDueDate] = useState(defaultDueDate)
  const [bankAccountId, setBankAccountId] = useState(defaultBankAccountId)
  const [taxPercent, setTaxPercent] = useState(String(defaultTaxPercent))

  const projectId = preselectedProjectId
  const scheduleItemIds = preloadedScheduleItems.map((s) => s.id)

  const subtotal = lineItems.reduce((sum, li) => sum + (parseInt(li.amount) || 0), 0)
  const tax = Math.floor((subtotal * (parseFloat(taxPercent) || 0)) / 100)
  const total = subtotal + tax

  function addLine() {
    setLineItems((prev) => [...prev, { description: '', amount: '' }])
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function setLine(i: number, key: keyof LineItemRow, value: string) {
    setLineItems((prev) =>
      prev.map((li, idx) => (idx === i ? { ...li, [key]: value } : li)),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const clientId = selectedClientId
    if (!clientId) {
      toast.error('Select a client')
      return
    }
    const parsedItems = lineItems.map((li, i) => ({
      description: li.description.trim(),
      amount: parseInt(li.amount) || 0,
      sortOrder: i,
    }))
    if (parsedItems.some((li) => !li.description || li.amount <= 0)) {
      toast.error('All line items need a description and a positive amount')
      return
    }

    startTransition(async () => {
      const result = await createInvoice({
        clientId,
        ...(projectId !== undefined ? { projectId } : {}),
        ...(scheduleItemIds.length > 0 ? { scheduleItemIds } : {}),
        issueDate,
        dueDate,
        bankAccountId,
        taxPercent: parseFloat(taxPercent) || 0,
        lineItems: parsedItems,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Invoice ${result.data.invoiceNumber} created`)
      router.push(`/invoices/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client selector — hidden when locked by query params */}
      {lockedClientId === undefined && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Client</h2>
          <div className="space-y-1.5">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>

        <div className="space-y-2">
          {lineItems.map((li, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1">
                <Input
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => setLine(i, 'description', e.target.value)}
                />
              </div>
              <div className="w-36">
                <Input
                  placeholder="Amount (₹)"
                  type="number"
                  min="1"
                  value={li.amount}
                  onChange={(e) => setLine(i, 'amount', e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-600"
                onClick={() => removeLine(i)}
                disabled={lineItems.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Add Line
        </Button>

        {/* Totals preview */}
        <div className="border-t border-slate-100 pt-4 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax ({taxPercent || 0}%)</span>
            <span>₹{tax.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1 mt-1">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Invoice details */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <Label htmlFor="issueDate">Issue Date</Label>
          <Input
            id="issueDate"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxPercent">Tax %</Label>
          <Input
            id="taxPercent"
            type="number"
            min="0"
            max="100"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAccount">Bank Account</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger id="bankAccount">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((ba) => (
                <SelectItem key={ba.id} value={ba.id}>
                  {ba.label}
                  {ba.isDefault ? ' (default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  )
}
