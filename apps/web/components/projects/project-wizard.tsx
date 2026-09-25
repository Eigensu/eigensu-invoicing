'use client'

import { useReducer, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { buildSchedule } from '@eigensu/core'
import type { ProjectConfig } from '@eigensu/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createProject } from '@/lib/actions/projects'
import { formatDate } from '@/lib/format-date'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentModel = 'one_time' | 'installments' | 'subscription' | 'upfront_amc'
type Recurrence = 'monthly' | 'quarterly' | 'yearly'

interface InstallmentRow {
  label: string
  amount: string
  dueDate: string
}

interface WizardState {
  step: 1 | 2 | 3 | 4
  // Step 1
  clientId: string
  name: string
  description: string
  startDate: string
  endDate: string
  // Step 2
  paymentModel: PaymentModel | ''
  // Step 3 — shared
  totalValue: string
  // Step 3 — one_time
  oneTimeDueDate: string
  // Step 3 — installments
  installments: InstallmentRow[]
  // Step 3 — subscription
  subscriptionAmount: string
  subscriptionRecurrence: Recurrence
  // Step 3 — upfront_amc
  upfrontAmount: string
  upfrontDueDate: string
  amcAmount: string
  amcRecurrence: Recurrence
}

type Action =
  | { type: 'SET'; key: keyof WizardState; value: string | number }
  | { type: 'SET_STEP'; step: 1 | 2 | 3 | 4 }
  | { type: 'SET_MODEL'; model: PaymentModel }
  | { type: 'ADD_INSTALLMENT' }
  | { type: 'REMOVE_INSTALLMENT'; index: number }
  | { type: 'SET_INSTALLMENT'; index: number; key: keyof InstallmentRow; value: string }

const INITIAL: WizardState = {
  step: 1,
  clientId: '',
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  paymentModel: '',
  totalValue: '',
  oneTimeDueDate: '',
  installments: [{ label: 'Milestone 1', amount: '', dueDate: '' }],
  subscriptionAmount: '',
  subscriptionRecurrence: 'monthly',
  upfrontAmount: '',
  upfrontDueDate: '',
  amcAmount: '',
  amcRecurrence: 'yearly',
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.key]: action.value }
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_MODEL':
      return { ...state, paymentModel: action.model }
    case 'ADD_INSTALLMENT':
      return {
        ...state,
        installments: [
          ...state.installments,
          { label: `Milestone ${state.installments.length + 1}`, amount: '', dueDate: '' },
        ],
      }
    case 'REMOVE_INSTALLMENT':
      return {
        ...state,
        installments: state.installments.filter((_, i) => i !== action.index),
      }
    case 'SET_INSTALLMENT':
      return {
        ...state,
        installments: state.installments.map((row, i) =>
          i === action.index ? { ...row, [action.key]: action.value } : row,
        ),
      }
    default:
      return state
  }
}

// ─── Preview schedule via buildSchedule ──────────────────────────────────────

function buildPreview(state: WizardState) {
  if (!state.paymentModel || !state.startDate) return []
  try {
    const toDate = (s: string) => new Date(s + 'T00:00:00')
    const config: ProjectConfig = {
      paymentModel: state.paymentModel,
      startDate: toDate(state.startDate),
      ...(state.endDate ? { endDate: toDate(state.endDate) } : {}),
    }
    if (state.paymentModel === 'one_time') {
      config.oneTimeAmount = parseInt(state.totalValue) || 0
      if (state.oneTimeDueDate) config.oneTimeDueDate = toDate(state.oneTimeDueDate)
    } else if (state.paymentModel === 'installments') {
      config.installments = state.installments
        .filter((i) => i.label && i.amount && i.dueDate)
        .map((i) => ({ label: i.label, amount: parseInt(i.amount) || 0, dueDate: toDate(i.dueDate) }))
    } else if (state.paymentModel === 'subscription') {
      if (state.subscriptionAmount) config.subscriptionAmount = parseInt(state.subscriptionAmount) || 0
      config.subscriptionRecurrence = state.subscriptionRecurrence
    } else if (state.paymentModel === 'upfront_amc') {
      if (state.upfrontAmount) config.upfrontAmount = parseInt(state.upfrontAmount) || 0
      if (state.upfrontDueDate) config.upfrontDueDate = toDate(state.upfrontDueDate)
      if (state.amcAmount) config.amcAmount = parseInt(state.amcAmount) || 0
      config.amcRecurrence = state.amcRecurrence
    }
    return buildSchedule(config)
  } catch {
    return []
  }
}

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS = ['Basics', 'Payment Model', 'Schedule', 'Review']

function StepHeader({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            i + 1 === current
              ? 'bg-eigensu-blue text-white'
              : i + 1 < current
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400',
          )}>
            {i + 1 < current ? '✓' : i + 1}
          </div>
          <span className={cn(
            'text-sm',
            i + 1 === current ? 'font-medium text-slate-900' : 'text-slate-400',
          )}>
            {label}
          </span>
          {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
        </div>
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  clients: { id: string; name: string }[]
  defaultClientId?: string
}

export function ProjectWizard({ clients, defaultClientId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL,
    clientId: defaultClientId ?? '',
  })

  // ── Step validators ────────────────────────────────────────────────────────

  function validateStep1() {
    if (!state.clientId) { toast.error('Select a client'); return false }
    if (!state.name.trim()) { toast.error('Project name is required'); return false }
    if (!state.startDate) { toast.error('Start date is required'); return false }
    return true
  }

  function validateStep2() {
    if (!state.paymentModel) { toast.error('Select a payment model'); return false }
    return true
  }

  function validateStep3() {
    if (!state.paymentModel) return false
    if (state.paymentModel === 'one_time') {
      if (!state.totalValue || parseInt(state.totalValue) <= 0) { toast.error('Enter total value'); return false }
      if (!state.oneTimeDueDate) { toast.error('Enter a due date'); return false }
    } else if (state.paymentModel === 'installments') {
      if (state.installments.length === 0) { toast.error('Add at least one installment'); return false }
      for (const inst of state.installments) {
        if (!inst.label || !inst.amount || !inst.dueDate) {
          toast.error('Fill in all installment rows'); return false
        }
        if (parseInt(inst.amount) <= 0) { toast.error('Installment amounts must be positive'); return false }
      }
      const projectTotal = parseInt(state.totalValue) || 0
      if (projectTotal <= 0) { toast.error('Enter total value'); return false }
      const installmentTotal = state.installments.reduce((sum, i) => sum + (parseInt(i.amount) || 0), 0)
      if (installmentTotal !== projectTotal) {
        toast.error(
          `Installment amounts (₹${installmentTotal.toLocaleString('en-IN')}) must equal total value (₹${projectTotal.toLocaleString('en-IN')})`
        )
        return false
      }
    } else if (state.paymentModel === 'subscription') {
      if (!state.subscriptionAmount || parseInt(state.subscriptionAmount) <= 0) {
        toast.error('Enter subscription amount'); return false
      }
      if (!state.endDate) { toast.error('End date is required for subscription'); return false }
    } else if (state.paymentModel === 'upfront_amc') {
      if (!state.upfrontAmount || parseInt(state.upfrontAmount) <= 0) {
        toast.error('Enter upfront amount'); return false
      }
      if (!state.upfrontDueDate) { toast.error('Enter upfront due date'); return false }
      if (!state.amcAmount || parseInt(state.amcAmount) <= 0) {
        toast.error('Enter AMC amount'); return false
      }
      if (!state.endDate) { toast.error('End date is required for AMC schedule'); return false }
    }
    return true
  }

  function advance() {
    if (state.step === 1 && !validateStep1()) return
    if (state.step === 2 && !validateStep2()) return
    if (state.step === 3 && !validateStep3()) return
    dispatch({ type: 'SET_STEP', step: (state.step + 1) as 1 | 2 | 3 | 4 })
  }

  function back() {
    dispatch({ type: 'SET_STEP', step: (state.step - 1) as 1 | 2 | 3 | 4 })
  }

  function handleSubmit() {
    if (!state.paymentModel) return
    startTransition(async () => {
      const base = {
        clientId: state.clientId,
        name: state.name.trim(),
        paymentModel: state.paymentModel as PaymentModel,
        totalValue: parseInt(state.totalValue) || 0,
        startDate: state.startDate,
        ...(state.description.trim() ? { description: state.description.trim() } : {}),
        ...(state.endDate ? { endDate: state.endDate } : {}),
      }

      let extra = {}
      if (state.paymentModel === 'one_time') {
        extra = { ...(state.oneTimeDueDate ? { oneTimeDueDate: state.oneTimeDueDate } : {}) }
      } else if (state.paymentModel === 'installments') {
        extra = {
          installments: state.installments.map((i) => ({
            label: i.label,
            amount: parseInt(i.amount),
            dueDate: i.dueDate,
          })),
        }
      } else if (state.paymentModel === 'subscription') {
        extra = {
          subscriptionAmount: parseInt(state.subscriptionAmount),
          subscriptionRecurrence: state.subscriptionRecurrence,
        }
      } else if (state.paymentModel === 'upfront_amc') {
        extra = {
          upfrontAmount: parseInt(state.upfrontAmount),
          upfrontDueDate: state.upfrontDueDate,
          amcAmount: parseInt(state.amcAmount),
          amcRecurrence: state.amcRecurrence,
        }
      }

      const result = await createProject({ ...base, ...extra })
      if (!result.success) { toast.error(result.error); return }
      toast.success('Project created')
      router.push(`/projects/${result.data.id}`)
    })
  }

  const set = (key: keyof WizardState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    dispatch({ type: 'SET', key, value: e.target.value })

  const preview = state.step === 4 ? buildPreview(state) : []

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <StepHeader current={state.step} />

      <div className="rounded-lg border border-slate-200 bg-white p-6">

        {/* ── Step 1: Basics ─────────────────────────────────────────────── */}
        {state.step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Project Basics</h2>

            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client *</Label>
              <Select
                value={state.clientId}
                onValueChange={(v) => dispatch({ type: 'SET', key: 'clientId', value: v })}
              >
                <SelectTrigger id="clientId">
                  <SelectValue placeholder="Select a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" value={state.name} onChange={set('name')} placeholder="Website Redesign" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={state.description} onChange={set('description')} rows={2} placeholder="Brief description of scope…" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" value={state.startDate} onChange={set('startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={state.endDate} onChange={set('endDate')} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Payment Model ──────────────────────────────────────── */}
        {state.step === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Payment Model</h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'one_time', label: 'One-Time', desc: 'Single payment on a fixed date' },
                  { value: 'installments', label: 'Installments', desc: 'Custom milestones, each with its own amount and date' },
                  { value: 'subscription', label: 'Subscription', desc: 'Recurring fixed amount monthly, quarterly, or yearly' },
                  { value: 'upfront_amc', label: 'Upfront + AMC', desc: 'Lump-sum upfront followed by recurring annual maintenance' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_MODEL', model: option.value })}
                  className={cn(
                    'rounded-lg border-2 p-4 text-left transition-colors',
                    state.paymentModel === option.value
                      ? 'border-eigensu-blue bg-eigensu-bg'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <p className="font-medium text-slate-900">{option.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Schedule Config ────────────────────────────────────── */}
        {state.step === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Schedule Configuration</h2>

            {/* One-Time */}
            {state.paymentModel === 'one_time' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="totalValue">Total Value (₹) *</Label>
                  <Input id="totalValue" type="number" min="1" step="1" value={state.totalValue} onChange={set('totalValue')} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oneTimeDueDate">Due Date *</Label>
                  <Input id="oneTimeDueDate" type="date" value={state.oneTimeDueDate} onChange={set('oneTimeDueDate')} />
                </div>
              </div>
            )}

            {/* Installments */}
            {state.paymentModel === 'installments' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="totalValue">Total Value (₹) *</Label>
                  <Input id="totalValue" type="number" min="1" step="1" value={state.totalValue} onChange={set('totalValue')} placeholder="0" />
                </div>
                <div className="space-y-2">
                  {state.installments.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                      <div className="space-y-1">
                        {i === 0 && <Label>Label</Label>}
                        <Input
                          value={row.label}
                          onChange={(e) => dispatch({ type: 'SET_INSTALLMENT', index: i, key: 'label', value: e.target.value })}
                          placeholder="Milestone 1"
                        />
                      </div>
                      <div className="space-y-1 w-28">
                        {i === 0 && <Label>Amount (₹)</Label>}
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={row.amount}
                          onChange={(e) => dispatch({ type: 'SET_INSTALLMENT', index: i, key: 'amount', value: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <Label>Due Date</Label>}
                        <Input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => dispatch({ type: 'SET_INSTALLMENT', index: i, key: 'dueDate', value: e.target.value })}
                        />
                      </div>
                      <div className={i === 0 ? 'pt-6' : ''}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-slate-400 hover:text-red-500"
                          disabled={state.installments.length <= 1}
                          onClick={() => dispatch({ type: 'REMOVE_INSTALLMENT', index: i })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: 'ADD_INSTALLMENT' })}>
                    <Plus className="h-4 w-4" />Add Installment
                  </Button>
                </div>
              </div>
            )}

            {/* Subscription */}
            {state.paymentModel === 'subscription' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subscriptionAmount">Amount per Period (₹) *</Label>
                    <Input id="subscriptionAmount" type="number" min="1" step="1" value={state.subscriptionAmount} onChange={set('subscriptionAmount')} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recurrence *</Label>
                    <Select
                      value={state.subscriptionRecurrence}
                      onValueChange={(v) => dispatch({ type: 'SET', key: 'subscriptionRecurrence', value: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">End date (set in Step 1) determines how many billing periods are generated.</p>
                {!state.endDate && (
                  <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    No end date set — go back to Step 1 to add one.
                  </p>
                )}
              </div>
            )}

            {/* Upfront + AMC */}
            {state.paymentModel === 'upfront_amc' && (
              <div className="space-y-4">
                <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Upfront Payment</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="upfrontAmount">Amount (₹) *</Label>
                      <Input id="upfrontAmount" type="number" min="1" step="1" value={state.upfrontAmount} onChange={set('upfrontAmount')} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="upfrontDueDate">Due Date *</Label>
                      <Input id="upfrontDueDate" type="date" value={state.upfrontDueDate} onChange={set('upfrontDueDate')} />
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Annual Maintenance (AMC)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="amcAmount">Amount per Period (₹) *</Label>
                      <Input id="amcAmount" type="number" min="1" step="1" value={state.amcAmount} onChange={set('amcAmount')} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Recurrence *</Label>
                      <Select
                        value={state.amcRecurrence}
                        onValueChange={(v) => dispatch({ type: 'SET', key: 'amcRecurrence', value: v })}
                      >
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
                {!state.endDate && (
                  <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    No end date set — go back to Step 1 to add one.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review ─────────────────────────────────────────────── */}
        {state.step === 4 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-slate-900">Review & Confirm</h2>

            {/* Summary */}
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Client</span>
                <span className="font-medium">{clients.find((c) => c.id === state.clientId)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Project</span>
                <span className="font-medium">{state.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Model</span>
                <Badge variant="secondary">
                  {state.paymentModel === 'one_time' ? 'One-Time'
                    : state.paymentModel === 'installments' ? 'Installments'
                    : state.paymentModel === 'subscription' ? 'Subscription'
                    : 'Upfront + AMC'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Start Date</span>
                <span>{state.startDate}</span>
              </div>
              {state.endDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">End Date</span>
                  <span>{state.endDate}</span>
                </div>
              )}
            </div>

            {/* Schedule preview */}
            {preview.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Schedule Preview ({preview.length} item{preview.length !== 1 ? 's' : ''})
                </p>
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-slate-900">{item.label}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.type}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {formatDate(item.dueDate)}
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.amount.toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No schedule items will be generated.</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={back} disabled={state.step === 1}>
          <ChevronLeft className="h-4 w-4" />Back
        </Button>
        {state.step < 4 ? (
          <Button type="button" onClick={advance}>
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Project'}
          </Button>
        )}
      </div>
    </div>
  )
}
