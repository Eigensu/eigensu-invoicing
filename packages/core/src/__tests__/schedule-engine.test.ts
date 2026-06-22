import { describe, it, expect } from 'vitest'
import { buildSchedule, type ProjectConfig } from '../schedule-engine'

const START = new Date('2026-07-01')
const END_12M = new Date('2027-07-01')

describe('buildSchedule — one_time', () => {
  it('produces exactly 1 schedule item', () => {
    const config: ProjectConfig = {
      paymentModel: 'one_time',
      startDate: START,
      oneTimeAmount: 100000,
      oneTimeDueDate: new Date('2026-07-31'),
    }
    const items = buildSchedule(config)
    expect(items).toHaveLength(1)
    expect(items[0]?.type).toBe('one_time')
    expect(items[0]?.amount).toBe(100000)
    expect(items[0]?.dueDate).toEqual(new Date('2026-07-31'))
  })

  it('throws if fields are missing', () => {
    const config: ProjectConfig = { paymentModel: 'one_time', startDate: START }
    expect(() => buildSchedule(config)).toThrow()
  })
})

describe('buildSchedule — installments', () => {
  it('produces exactly N items with correct amounts and dates', () => {
    const config: ProjectConfig = {
      paymentModel: 'installments',
      startDate: START,
      installments: [
        { label: '1st Installment', amount: 50000, dueDate: new Date('2026-07-31') },
        { label: '2nd Installment', amount: 50000, dueDate: new Date('2026-08-31') },
        { label: '3rd Installment', amount: 25000, dueDate: new Date('2026-09-30') },
      ],
    }
    const items = buildSchedule(config)
    expect(items).toHaveLength(3)
    expect(items[0]?.label).toBe('1st Installment')
    expect(items[0]?.amount).toBe(50000)
    expect(items[1]?.amount).toBe(50000)
    expect(items[2]?.amount).toBe(25000)
    expect(items[2]?.dueDate).toEqual(new Date('2026-09-30'))
  })

  it('is deterministic — same input produces same output', () => {
    const config: ProjectConfig = {
      paymentModel: 'installments',
      startDate: START,
      installments: [{ label: 'Only', amount: 100000, dueDate: new Date('2026-08-01') }],
    }
    expect(buildSchedule(config)).toEqual(buildSchedule(config))
  })
})

describe('buildSchedule — subscription', () => {
  it('generates monthly items from month 1 to end date', () => {
    const config: ProjectConfig = {
      paymentModel: 'subscription',
      startDate: START,
      endDate: END_12M,
      subscriptionAmount: 10000,
      subscriptionRecurrence: 'monthly',
    }
    const items = buildSchedule(config)
    expect(items).toHaveLength(12)
    expect(items[0]?.type).toBe('subscription')
    expect(items[0]?.dueDate).toEqual(new Date('2026-08-01'))
    expect(items[11]?.dueDate).toEqual(new Date('2027-07-01'))
    items.forEach((item) => expect(item.amount).toBe(10000))
  })

  it('throws if endDate is missing', () => {
    const config: ProjectConfig = {
      paymentModel: 'subscription',
      startDate: START,
      subscriptionAmount: 10000,
      subscriptionRecurrence: 'monthly',
    }
    expect(() => buildSchedule(config)).toThrow()
  })
})

describe('buildSchedule — upfront_amc', () => {
  it('produces 1 upfront + N monthly AMC items', () => {
    // endDate must be >= the last AMC date (2027-07-15) to include it
    const config: ProjectConfig = {
      paymentModel: 'upfront_amc',
      startDate: START,
      endDate: new Date('2027-07-31'),  // covers all 12 monthly AMC items
      upfrontAmount: 200000,
      upfrontDueDate: new Date('2026-07-15'),
      amcAmount: 15000,
      amcRecurrence: 'monthly',
    }
    const items = buildSchedule(config)
    // 1 upfront + 12 months of AMC: Aug 15 2026 → Jul 15 2027
    expect(items[0]?.type).toBe('one_time')
    expect(items[0]?.amount).toBe(200000)
    expect(items[0]?.dueDate).toEqual(new Date('2026-07-15'))
    const amcItems = items.slice(1)
    expect(amcItems).toHaveLength(12)
    amcItems.forEach((item) => {
      expect(item.type).toBe('amc')
      expect(item.amount).toBe(15000)
    })
    expect(amcItems[0]?.dueDate).toEqual(new Date('2026-08-15'))
    expect(amcItems[11]?.dueDate).toEqual(new Date('2027-07-15'))
  })
})
