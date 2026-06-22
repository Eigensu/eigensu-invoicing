import { describe, it, expect } from 'vitest'
import { dueReminders, type ReminderRule, type InvoiceSummary } from '../reminder-rules'

const rules: ReminderRule[] = [
  { id: 'r1', type: 'client_due_soon', offsetDays: -7, enabled: true,  ccFounders: false },
  { id: 'r2', type: 'client_due',      offsetDays:  0, enabled: true,  ccFounders: false },
  { id: 'r3', type: 'client_overdue',  offsetDays:  7, enabled: true,  ccFounders: false },
  { id: 'r4', type: 'client_overdue',  offsetDays: 15, enabled: true,  ccFounders: true  },
  { id: 'r5', type: 'internal_alert',  offsetDays: 30, enabled: true,  ccFounders: true  },
]

const invoice: InvoiceSummary = {
  id: 'inv1',
  dueDate: new Date('2026-07-01'),
  status: 'sent',
}

const none = new Set<string>()

describe('dueReminders', () => {
  it('fires due-soon 7 days before due date', () => {
    const today = new Date('2026-06-24')
    const result = dueReminders(invoice, rules, today, none)
    expect(result.map((f) => f.rule.id)).toEqual(['r1'])
  })

  it('fires due-soon and due-today on the due date', () => {
    const today = new Date('2026-07-01')
    const result = dueReminders(invoice, rules, today, none)
    expect(result.map((f) => f.rule.id)).toContain('r1')
    expect(result.map((f) => f.rule.id)).toContain('r2')
  })

  it('fires r1, r2, r3 at 7 days overdue', () => {
    const today = new Date('2026-07-08')
    const ids = dueReminders(invoice, rules, today, none).map((f) => f.rule.id)
    expect(ids).toContain('r1')
    expect(ids).toContain('r2')
    expect(ids).toContain('r3')
    expect(ids).not.toContain('r4')
    expect(ids).not.toContain('r5')
  })

  it('fires r1-r4 at 15 days overdue — both overdue rules fire independently', () => {
    const today = new Date('2026-07-16')
    const ids = dueReminders(invoice, rules, today, none).map((f) => f.rule.id)
    expect(ids).toContain('r3')
    expect(ids).toContain('r4')
  })

  it('fires all 5 rules at 30 days overdue', () => {
    const today = new Date('2026-07-31')
    const ids = dueReminders(invoice, rules, today, none).map((f) => f.rule.id)
    expect(ids).toHaveLength(5)
  })

  it('excludes already-sent rule IDs', () => {
    const today = new Date('2026-07-08')
    const alreadySent = new Set(['r1', 'r2'])
    const ids = dueReminders(invoice, rules, today, alreadySent).map((f) => f.rule.id)
    expect(ids).toEqual(['r3'])
  })

  it('never fires disabled rules', () => {
    const rulesWithDisabled: ReminderRule[] = [
      { id: 'r1', type: 'client_due_soon', offsetDays: -7, enabled: false, ccFounders: false },
      { id: 'r2', type: 'client_due',      offsetDays:  0, enabled: true,  ccFounders: false },
    ]
    const today = new Date('2026-07-01')
    const ids = dueReminders(invoice, rulesWithDisabled, today, none).map((f) => f.rule.id)
    expect(ids).not.toContain('r1')
    expect(ids).toContain('r2')
  })

  it('returns empty array before any rule fires', () => {
    const today = new Date('2026-06-20')
    const result = dueReminders(invoice, rules, today, none)
    expect(result).toHaveLength(0)
  })

  it('r3 and r4 are both returned at 15 days — proves two same-type rules fire separately', () => {
    const today = new Date('2026-07-16')
    const ids = dueReminders(invoice, rules, today, none).map((f) => f.rule.id)
    // Both client_overdue rules must appear — this validates the A2 gap fix
    expect(ids.filter((id) => ['r3', 'r4'].includes(id))).toHaveLength(2)
  })
})
