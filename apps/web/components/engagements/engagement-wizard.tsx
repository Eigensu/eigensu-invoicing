'use client'

import { useReducer, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Trash2, Check, ChevronLeft, ChevronRight, CheckCircle2, Pencil,
} from 'lucide-react'
import { buildSchedule, formatINR } from '@eigensu/core'
import type { ProjectConfig, ScheduleItemDraft } from '@eigensu/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createEngagement } from '@/lib/actions/engagement'
import { sendInvoice } from '@/lib/actions/invoices'
import { formatDate } from '@/lib/format-date'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentModel = 'one_time' | 'installments' | 'subscription' | 'upfront_amc'
type WizardRecurrence = 'monthly' | 'quarterly' | 'yearly'

interface InstallRow { label: string; amount: string; dueDate: string }

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5
  // Step 1 – Client
  clientMode: 'existing' | 'new'
  existingClientId: string
  ncName: string; ncEmail: string; ncContact: string
  ncPhone: string; ncAddress: string; ncGst: string
  // Step 2 – Project
  projectName: string; projectStart: string; projectEnd: string; projectDesc: string
  // Step 3 – Payment model
  paymentModel: PaymentModel | ''
  // Step 4 – Schedule
  totalValue: string
  oneTimeDueDate: string
  installments: InstallRow[]
  subscriptionAmount: string; subscriptionRecurrence: WizardRecurrence
  upfrontAmount: string; upfrontDueDate: string
  amcAmount: string; amcRecurrence: WizardRecurrence
  // Step 5 – Invoice
  invoiceItemIndices: number[]
  bankAccountId: string; issueDate: string; dueDate: string; taxPercent: number
}

type Action =
  | { type: 'SET'; key: keyof WizardState; value: string | number | number[] }
  | { type: 'STEP'; step: 1 | 2 | 3 | 4 | 5 }
  | { type: 'MODEL'; model: PaymentModel }
  | { type: 'ADD_ROW' }
  | { type: 'DEL_ROW'; i: number }
  | { type: 'SET_ROW'; i: number; key: keyof InstallRow; value: string }
  | { type: 'TOGGLE'; i: number }

function reducer(s: WizardState, a: Action): WizardState {
  switch (a.type) {
    case 'SET':    return { ...s, [a.key]: a.value }
    case 'STEP':   return { ...s, step: a.step }
    case 'MODEL':  return { ...s, paymentModel: a.model, invoiceItemIndices: [] }
    case 'ADD_ROW': return {
      ...s,
      installments: [...s.installments, {
        label: `${s.projectName || 'Project'} Installment ${s.installments.length + 1}`,
        amount: '',
        dueDate: s.projectStart,
      }],
    }
    case 'DEL_ROW': return { ...s, installments: s.installments.filter((_, i) => i !== a.i) }
    case 'SET_ROW': return {
      ...s,
      installments: s.installments.map((r, i) => i === a.i ? { ...r, [a.key]: a.value } : r),
    }
    case 'TOGGLE': {
      const has = s.invoiceItemIndices.includes(a.i)
      return {
        ...s,
        invoiceItemIndices: has
          ? s.invoiceItemIndices.filter(x => x !== a.i)
          : [...s.invoiceItemIndices, a.i],
      }
    }
    default: return s
  }
}

// ─── Preview (client-side schedule) ──────────────────────────────────────────

function preview(s: WizardState): ScheduleItemDraft[] {
  const m = s.paymentModel
  if (!m || !s.projectStart) return []
  try {
    const d = (str: string) => new Date(str + 'T00:00:00')
    const cfg: ProjectConfig = {
      paymentModel: m,
      startDate: d(s.projectStart),
      ...(s.projectEnd ? { endDate: d(s.projectEnd) } : {}),
    }
    if (m === 'one_time') {
      cfg.oneTimeAmount = parseInt(s.totalValue) || 0
      if (s.oneTimeDueDate) cfg.oneTimeDueDate = d(s.oneTimeDueDate)
    } else if (m === 'installments') {
      cfg.installments = s.installments
        .filter(r => r.label && r.amount && r.dueDate)
        .map(r => ({ label: r.label, amount: parseInt(r.amount) || 0, dueDate: d(r.dueDate) }))
    } else if (m === 'subscription') {
      cfg.subscriptionAmount = parseInt(s.subscriptionAmount) || 0
      cfg.subscriptionRecurrence = s.subscriptionRecurrence
    } else if (m === 'upfront_amc') {
      cfg.upfrontAmount = parseInt(s.upfrontAmount) || 0
      if (s.upfrontDueDate) cfg.upfrontDueDate = d(s.upfrontDueDate)
      cfg.amcAmount = parseInt(s.amcAmount) || 0
      cfg.amcRecurrence = s.amcRecurrence
    }
    return buildSchedule(cfg)
  } catch {
    return []
  }
}

const STEPS = ['Client', 'Project', 'Payment', 'Schedule', 'Review']
const TYPE_LABEL: Record<string, string> = {
  one_time: 'One-time', installment: 'Installment', subscription: 'Subscription', amc: 'AMC',
}
const MODEL_OPTIONS = [
  { value: 'one_time' as PaymentModel,     label: 'One-Time',       desc: 'Single payment on a fixed date.' },
  { value: 'installments' as PaymentModel, label: 'Installments',   desc: 'Custom milestones, each with its own amount and date.' },
  { value: 'subscription' as PaymentModel, label: 'Subscription',   desc: 'Recurring fixed amount every month / quarter / year.' },
  { value: 'upfront_amc' as PaymentModel,  label: 'Upfront + AMC',  desc: 'Lump-sum upfront followed by recurring maintenance charges.' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clients: { id: string; name: string }[]
  bankAccounts: { id: string; label: string; isDefault: boolean }[]
  defaultBankAccountId: string
  defaultTaxPercent: number
  defaultIssueDate: string
  defaultDueDate: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EngagementWizard({
  clients, bankAccounts,
  defaultBankAccountId, defaultTaxPercent,
  defaultIssueDate, defaultDueDate,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<{
    projectId: string; invoiceId: string; invoiceNumber: string; sent: boolean
  } | null>(null)

  const INIT: WizardState = {
    step: 1,
    clientMode: 'existing', existingClientId: clients[0]?.id ?? '',
    ncName: '', ncEmail: '', ncContact: '', ncPhone: '', ncAddress: '', ncGst: '',
    projectName: '', projectStart: defaultIssueDate, projectEnd: '', projectDesc: '',
    paymentModel: '',
    totalValue: '', oneTimeDueDate: defaultDueDate,
    installments: [{ label: 'Installment 1', amount: '', dueDate: defaultIssueDate }],
    subscriptionAmount: '', subscriptionRecurrence: 'monthly',
    upfrontAmount: '', upfrontDueDate: defaultIssueDate,
    amcAmount: '', amcRecurrence: 'yearly',
    invoiceItemIndices: [],
    bankAccountId: defaultBankAccountId, issueDate: defaultIssueDate,
    dueDate: defaultDueDate, taxPercent: defaultTaxPercent,
  }

  const [s, d] = useReducer(reducer, INIT)
  const set = (key: keyof WizardState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    d({ type: 'SET', key, value: e.target.value })

  const items = preview(s)
  const clientName = s.clientMode === 'existing'
    ? (clients.find(c => c.id === s.existingClientId)?.name ?? '—')
    : (s.ncName || '(unnamed client)')
  const clientEmail = s.clientMode === 'existing'
    ? '' : s.ncEmail

  // Validators
  const ok1 = s.clientMode === 'existing'
    ? !!s.existingClientId
    : s.ncName.trim() !== '' && s.ncEmail.includes('@')
  const ok2 = s.projectName.trim() !== '' && !!s.projectStart
  const ok3 = s.paymentModel !== ''
  const ok4 = (() => {
    const m = s.paymentModel
    if (!m) return false
    if (m === 'one_time') return parseInt(s.totalValue) > 0 && !!s.oneTimeDueDate
    if (m === 'installments') return (
      s.installments.length > 0 &&
      s.installments.every(r => r.label && parseInt(r.amount) > 0 && r.dueDate) &&
      parseInt(s.totalValue) > 0
    )
    if (m === 'subscription') return parseInt(s.subscriptionAmount) > 0 && !!s.projectEnd
    if (m === 'upfront_amc') return parseInt(s.upfrontAmount) > 0 && !!s.upfrontDueDate && parseInt(s.amcAmount) > 0 && !!s.projectEnd
    return false
  })()
  const ok5 = s.invoiceItemIndices.length > 0 && !!s.bankAccountId

  const validators = [ok1, ok2, ok3, ok4]
  function advance() {
    if (!validators[s.step - 1]) { toast.error('Fill in all required fields first'); return }
    if (s.step === 4 && s.invoiceItemIndices.length === 0 && items.length > 0) {
      d({ type: 'TOGGLE', i: 0 })
    }
    d({ type: 'STEP', step: (s.step + 1) as 1 | 2 | 3 | 4 | 5 })
  }

  function handleSubmit(mode: 'send' | 'draft') {
    if (!ok5) { toast.error('Select at least one invoice item and a bank account'); return }
    const m = s.paymentModel as PaymentModel
    startTransition(async () => {
      const input: Record<string, unknown> = {
        clientMode: s.clientMode,
        projectName: s.projectName.trim(),
        projectStart: s.projectStart,
        paymentModel: m,
        invoiceItemIndices: s.invoiceItemIndices,
        bankAccountId: s.bankAccountId,
        issueDate: s.issueDate,
        dueDate: s.dueDate,
        taxPercent: s.taxPercent,
      }
      if (s.clientMode === 'existing') {
        input.existingClientId = s.existingClientId
      } else {
        input.newClient = {
          name: s.ncName.trim(), email: s.ncEmail.trim(),
          ...(s.ncContact.trim() ? { contactPerson: s.ncContact.trim() } : {}),
          ...(s.ncPhone.trim() ? { phone: s.ncPhone.trim() } : {}),
          ...(s.ncAddress.trim() ? { billingAddress: s.ncAddress.trim() } : {}),
          ...(s.ncGst.trim() ? { gstId: s.ncGst.trim() } : {}),
        }
      }
      if (s.projectDesc.trim()) input.projectDescription = s.projectDesc.trim()
      if (s.projectEnd) input.projectEnd = s.projectEnd
      if (m === 'one_time') {
        input.totalValue = parseInt(s.totalValue)
        input.oneTimeDueDate = s.oneTimeDueDate
      } else if (m === 'installments') {
        input.totalValue = parseInt(s.totalValue)
        input.installments = s.installments.map(r => ({ label: r.label, amount: parseInt(r.amount), dueDate: r.dueDate }))
      } else if (m === 'subscription') {
        input.subscriptionAmount = parseInt(s.subscriptionAmount)
        input.subscriptionRecurrence = s.subscriptionRecurrence
      } else if (m === 'upfront_amc') {
        input.upfrontAmount = parseInt(s.upfrontAmount)
        input.upfrontDueDate = s.upfrontDueDate
        input.amcAmount = parseInt(s.amcAmount)
        input.amcRecurrence = s.amcRecurrence
      }

      const result = await createEngagement(input)
      if (!result.success) { toast.error(result.error); return }

      let sent = false
      if (mode === 'send') {
        const sr = await sendInvoice(result.data.invoiceId)
        if (!sr.success) {
          toast.error(`Engagement created but email failed: ${sr.error}`)
        } else {
          sent = true
        }
      }
      setDone({ projectId: result.data.projectId, invoiceId: result.data.invoiceId, invoiceNumber: result.data.invoiceNumber, sent })
    })
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="mx-auto max-w-[480px] mt-10 text-center">
        <div className="bg-white border border-border rounded-2xl p-10 shadow-[0_4px_24px_rgba(39,52,105,0.08)]">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="font-display text-[22px] font-bold text-charcoal mb-2">Engagement created</h2>
          <p className="text-sm text-charcoal-600 leading-relaxed mb-7">
            {done.sent
              ? `Invoice ${done.invoiceNumber} has been emailed to the client.`
              : `Invoice ${done.invoiceNumber} saved as draft — send it whenever you're ready.`}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push(`/invoices/${done.invoiceId}`)}>
              View Invoice
            </Button>
            <Button className="bg-navy hover:bg-navy-hover text-white" onClick={() => router.push(`/projects/${done.projectId}`)}>
              View Project
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const selTotal = s.invoiceItemIndices.reduce((a, i) => a + (items[i]?.amount ?? 0), 0)

  // ── Client chip (steps 2–5) ─────────────────────────────────────────────────
  const ClientChip = () => (
    <div className="flex items-center gap-2.5 rounded-lg bg-cream-mid px-3.5 py-2 mb-5">
      <div className="h-7 w-7 shrink-0 rounded-full bg-navy flex items-center justify-center text-[11px] font-semibold text-white uppercase">
        {clientName.slice(0, 2)}
      </div>
      <span className="text-xs text-charcoal-600">Client:</span>
      <span className="text-sm font-medium text-charcoal">{clientName}</span>
      <button
        className="ml-auto text-xs text-sky font-medium hover:underline flex items-center gap-1"
        onClick={() => d({ type: 'STEP', step: 1 })}
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  )

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs text-charcoal-600 mb-0.5">Projects › New</p>
        <h1 className="font-display text-2xl font-bold text-charcoal">New Engagement</h1>
        <p className="text-sm text-charcoal-600 mt-1">Set up a client, project, payment schedule, and first invoice in one flow.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className={cn(
                'flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-semibold shrink-0',
                i + 1 <= s.step ? 'bg-navy text-white' : 'bg-white border-[1.5px] border-border-strong text-charcoal-400'
              )}>
                {i + 1 < s.step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={cn(
                'text-xs whitespace-nowrap hidden sm:block',
                i + 1 === s.step ? 'text-charcoal font-medium' : i + 1 < s.step ? 'text-charcoal-600' : 'text-charcoal-400'
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-[2px] flex-1 mx-2 min-w-[10px]', i + 1 < s.step ? 'bg-navy' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <div className="bg-white border border-border rounded-xl shadow-[0_1px_4px_rgba(39,52,105,0.06)] p-6">

        {/* ── Step 1: Client ──────────────────────────────────────────── */}
        {s.step === 1 && (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-sky uppercase tracking-wider mb-4">Step 1 — Who is this for?</p>

            {/* Toggle */}
            <div className="inline-flex rounded-lg bg-cream-mid p-1 gap-1 mb-4">
              {(['existing', 'new'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => d({ type: 'SET', key: 'clientMode', value: mode })}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                    s.clientMode === mode ? 'bg-white text-navy shadow-sm' : 'text-charcoal-600 hover:text-charcoal'
                  )}
                >
                  {mode === 'existing' ? 'Existing client' : 'New client'}
                </button>
              ))}
            </div>

            {s.clientMode === 'existing' ? (
              <div className="space-y-1.5">
                <Label>Client <span className="text-rose">*</span></Label>
                {clients.length === 0 ? (
                  <p className="text-sm text-charcoal-600 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    No active clients yet — add one in <a href="/records/clients" className="text-navy underline">Clients</a> first.
                  </p>
                ) : (
                  <Select value={s.existingClientId} onValueChange={(v) => d({ type: 'SET', key: 'existingClientId', value: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a client…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-charcoal-600 mt-1">Picking an existing client avoids duplicates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-sky-soft border border-sky/20 px-4 py-3 text-xs text-charcoal-600 leading-relaxed">
                  This client will be created when you finish the engagement — nothing is saved until the final step.
                </div>
                <div className="space-y-1.5">
                  <Label>Name <span className="text-rose">*</span></Label>
                  <Input value={s.ncName} onChange={set('ncName')} placeholder="Acme Corp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Contact person</Label>
                    <Input value={s.ncContact} onChange={set('ncContact')} placeholder="Jane Smith" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-rose">*</span></Label>
                    <Input type="email" value={s.ncEmail} onChange={set('ncEmail')} placeholder="billing@client.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={s.ncPhone} onChange={set('ncPhone')} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST ID</Label>
                    <Input value={s.ncGst} onChange={set('ncGst')} placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing address</Label>
                  <Input value={s.ncAddress} onChange={set('ncAddress')} placeholder="123 Main St, City, State" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Project ─────────────────────────────────────────── */}
        {s.step === 2 && (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-sky uppercase tracking-wider mb-1">Step 2 — Project details</p>
            <ClientChip />
            <div className="space-y-1.5">
              <Label>Project name <span className="text-rose">*</span></Label>
              <Input value={s.projectName} onChange={set('projectName')} placeholder="e.g. Website Redesign" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start date <span className="text-rose">*</span></Label>
                <Input type="date" value={s.projectStart} onChange={set('projectStart')} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={s.projectEnd} onChange={set('projectEnd')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={s.projectDesc} onChange={set('projectDesc')} rows={2} placeholder="Scope, deliverables, context…" />
            </div>
          </div>
        )}

        {/* ── Step 3: Payment model ────────────────────────────────────── */}
        {s.step === 3 && (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-sky uppercase tracking-wider mb-1">Step 3 — How is it billed?</p>
            <ClientChip />
            <div className="grid grid-cols-2 gap-3">
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => d({ type: 'MODEL', model: opt.value })}
                  className={cn(
                    'rounded-xl border-[1.5px] p-4 text-left transition-all',
                    s.paymentModel === opt.value
                      ? 'border-navy bg-navy-muted'
                      : 'border-border hover:border-border-strong bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-charcoal">{opt.label}</span>
                    <div className={cn(
                      'h-4 w-4 rounded-full border-[1.5px] flex items-center justify-center',
                      s.paymentModel === opt.value ? 'border-navy' : 'border-border-strong'
                    )}>
                      {s.paymentModel === opt.value && <div className="h-2 w-2 rounded-full bg-navy" />}
                    </div>
                  </div>
                  <p className="text-xs text-charcoal-600 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: Schedule ─────────────────────────────────────────── */}
        {s.step === 4 && (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-sky uppercase tracking-wider mb-1">Step 4 — Payment schedule</p>
            <ClientChip />

            {/* One-time */}
            {s.paymentModel === 'one_time' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Total value (₹) <span className="text-rose">*</span></Label>
                  <Input type="number" min="1" step="1" value={s.totalValue} onChange={set('totalValue')} placeholder="100000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Due date <span className="text-rose">*</span></Label>
                  <Input type="date" value={s.oneTimeDueDate} onChange={set('oneTimeDueDate')} />
                </div>
              </div>
            )}

            {/* Installments */}
            {s.paymentModel === 'installments' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Project total value (₹) <span className="text-rose">*</span></Label>
                  <Input type="number" min="1" step="1" value={s.totalValue} onChange={set('totalValue')} placeholder="125000" />
                </div>
                <div className="space-y-2 mt-1">
                  <div className="grid grid-cols-[1fr_120px_150px_36px] gap-2 px-1">
                    <span className="text-xs font-medium text-charcoal-600">Label</span>
                    <span className="text-xs font-medium text-charcoal-600">Amount (₹)</span>
                    <span className="text-xs font-medium text-charcoal-600">Due date</span>
                    <span />
                  </div>
                  {s.installments.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_150px_36px] gap-2 items-center">
                      <Input value={row.label} onChange={(e) => d({ type: 'SET_ROW', i, key: 'label', value: e.target.value })} placeholder="Milestone 1" />
                      <Input type="number" min="1" step="1" value={row.amount} onChange={(e) => d({ type: 'SET_ROW', i, key: 'amount', value: e.target.value })} placeholder="0" />
                      <Input type="date" value={row.dueDate} onChange={(e) => d({ type: 'SET_ROW', i, key: 'dueDate', value: e.target.value })} />
                      <button
                        type="button"
                        onClick={() => d({ type: 'DEL_ROW', i })}
                        disabled={s.installments.length <= 1}
                        className="h-9 w-9 flex items-center justify-center rounded-md border border-border text-charcoal-400 hover:text-rose hover:border-rose disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => d({ type: 'ADD_ROW' })}
                    className="flex items-center gap-1.5 text-sm font-medium text-navy border border-dashed border-border-strong rounded-lg px-3 py-2 hover:bg-navy-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add installment
                  </button>
                  {/* Running total */}
                  {(() => {
                    const sum = s.installments.reduce((a, r) => a + (parseInt(r.amount) || 0), 0)
                    const total = parseInt(s.totalValue) || 0
                    const ok = total > 0 && sum === total
                    return (
                      <div className={cn('flex justify-between items-center px-4 py-2.5 rounded-lg text-sm mt-1', ok ? 'bg-emerald-50 text-emerald-700' : total > 0 ? 'bg-red-50 text-red-700' : 'bg-cream-mid text-charcoal-600')}>
                        <span>Installments total</span>
                        <span className="font-semibold">{formatINR(sum)}</span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Subscription */}
            {s.paymentModel === 'subscription' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Amount per cycle (₹) <span className="text-rose">*</span></Label>
                    <Input type="number" min="1" step="1" value={s.subscriptionAmount} onChange={set('subscriptionAmount')} placeholder="25000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recurrence</Label>
                    <Select value={s.subscriptionRecurrence} onValueChange={(v) => d({ type: 'SET', key: 'subscriptionRecurrence', value: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!s.projectEnd && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Set an end date in Step 2 to generate billing cycles.
                  </p>
                )}
              </div>
            )}

            {/* Upfront + AMC */}
            {s.paymentModel === 'upfront_amc' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-cream-mid border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-charcoal-600 uppercase tracking-wide">Upfront payment</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Amount (₹) <span className="text-rose">*</span></Label>
                      <Input type="number" min="1" step="1" value={s.upfrontAmount} onChange={set('upfrontAmount')} placeholder="200000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Due date <span className="text-rose">*</span></Label>
                      <Input type="date" value={s.upfrontDueDate} onChange={set('upfrontDueDate')} />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-cream-mid border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-charcoal-600 uppercase tracking-wide">Annual maintenance (AMC)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Amount / cycle (₹) <span className="text-rose">*</span></Label>
                      <Input type="number" min="1" step="1" value={s.amcAmount} onChange={set('amcAmount')} placeholder="15000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Recurrence</Label>
                      <Select value={s.amcRecurrence} onValueChange={(v) => d({ type: 'SET', key: 'amcRecurrence', value: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {!s.projectEnd && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Set an end date in Step 2 to generate AMC cycles.
                  </p>
                )}
              </div>
            )}

            {/* Live preview table */}
            {items.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-charcoal-600 mb-2">
                  Schedule preview — {items.length} item{items.length !== 1 ? 's' : ''} · {formatINR(items.reduce((a, x) => a + x.amount, 0))}
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-cream-mid">
                        <th className="px-3 py-2 text-left text-xs font-medium text-charcoal-600 uppercase tracking-[.04em]">Label</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-charcoal-600 uppercase tracking-[.04em]">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-charcoal-600 uppercase tracking-[.04em]">Due</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-charcoal-600 uppercase tracking-[.04em]">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2.5 text-charcoal">{item.label}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-navy-soft text-navy">
                              {TYPE_LABEL[item.type] ?? item.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-charcoal-600">{formatDate(item.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-charcoal">{formatINR(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review ───────────────────────────────────────────── */}
        {s.step === 5 && (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-sky uppercase tracking-wider mb-1">Step 5 — Review &amp; raise first invoice</p>

            {/* Client summary */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-charcoal">Client</span>
                <button className="text-xs text-sky font-medium hover:underline" onClick={() => d({ type: 'STEP', step: 1 })}>Edit</button>
              </div>
              <KV k="Name" v={clientName} />
              {clientEmail && <KV k="Email" v={clientEmail} />}
              <KV k="Type" v={s.clientMode === 'new' ? 'New client (will be created)' : 'Existing client'} />
            </div>

            {/* Project + schedule summary */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-charcoal">Project &amp; schedule</span>
                <button className="text-xs text-sky font-medium hover:underline" onClick={() => d({ type: 'STEP', step: 2 })}>Edit</button>
              </div>
              <KV k="Project" v={s.projectName} />
              <KV k="Model" v={MODEL_OPTIONS.find(o => o.value === s.paymentModel)?.label ?? '—'} />
              <KV k="Schedule" v={`${items.length} item${items.length !== 1 ? 's' : ''} · ${formatINR(items.reduce((a, x) => a + x.amount, 0))}`} />
            </div>

            {/* Invoice item selector */}
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-semibold text-charcoal mb-3">
                First invoice — select items to bill now <span className="text-rose">*</span>
              </p>
              {items.length === 0 ? (
                <p className="text-sm text-charcoal-400">No schedule items — go back to configure the schedule.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => {
                    const on = s.invoiceItemIndices.includes(i)
                    return (
                      <div
                        key={i}
                        onClick={() => d({ type: 'TOGGLE', i })}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                          on ? 'border-navy bg-navy-muted' : 'border-border hover:border-border-strong'
                        )}
                      >
                        <div className={cn(
                          'h-[18px] w-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0',
                          on ? 'bg-navy border-navy text-white' : 'border-border-strong'
                        )}>
                          {on && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-charcoal truncate">{item.label}</p>
                          <p className="text-xs text-charcoal-600">{TYPE_LABEL[item.type] ?? item.type} · due {formatDate(item.dueDate)}</p>
                        </div>
                        <span className="text-sm font-semibold text-charcoal shrink-0">{formatINR(item.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {items.length > 0 && (
                <div className="flex justify-between items-center mt-3 px-3 py-2.5 rounded-lg bg-cream-mid">
                  <span className="text-sm text-charcoal-600">Invoice total</span>
                  <span className="text-base font-bold text-navy">{formatINR(selTotal)}</span>
                </div>
              )}
            </div>

            {/* Invoice settings */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-charcoal mb-1">Invoice settings</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Bank account</Label>
                  <Select value={s.bankAccountId} onValueChange={(v) => d({ type: 'SET', key: 'bankAccountId', value: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Issue date</Label>
                  <Input type="date" value={s.issueDate} onChange={set('issueDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" value={s.dueDate} onChange={set('dueDate')} />
                </div>
              </div>
              {defaultTaxPercent > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-charcoal-600">Tax: {s.taxPercent}%</span>
                  {selTotal > 0 && s.taxPercent > 0 && (
                    <span className="text-xs text-charcoal-400">
                      (+{formatINR(Math.floor(selTotal * s.taxPercent / 100))} tax · total {formatINR(selTotal + Math.floor(selTotal * s.taxPercent / 100))})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => d({ type: 'STEP', step: (s.step - 1) as 1 | 2 | 3 | 4 | 5 })}
          className={s.step === 1 ? 'invisible' : ''}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <span className="text-xs text-charcoal-400">Step {s.step} of 5</span>

        {s.step < 5 ? (
          <Button className="bg-navy hover:bg-navy-hover text-white" onClick={advance}>
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-navy text-navy hover:bg-navy-muted"
              disabled={isPending || !ok5}
              onClick={() => handleSubmit('draft')}
            >
              {isPending ? 'Creating…' : 'Save as draft'}
            </Button>
            <Button
              className="bg-navy hover:bg-navy-hover text-white"
              disabled={isPending || !ok5}
              onClick={() => handleSubmit('send')}
            >
              {isPending ? 'Creating…' : 'Create & Send'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex text-sm mb-1.5 last:mb-0">
      <span className="w-28 shrink-0 text-charcoal-600">{k}</span>
      <span className="font-medium text-charcoal">{v}</span>
    </div>
  )
}
