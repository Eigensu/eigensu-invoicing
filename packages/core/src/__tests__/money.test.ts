import { describe, it, expect } from 'vitest'
import { toPaise, fromPaise, addAmounts, subtractAmounts, computeTax, formatINR } from '../money'

describe('toPaise / fromPaise', () => {
  it('converts whole rupees to paise', () => {
    expect(toPaise(125000)).toBe(12500000)
    expect(toPaise(1)).toBe(100)
    expect(toPaise(0)).toBe(0)
  })

  it('converts paise back to rupees', () => {
    expect(fromPaise(12500000)).toBe(125000)
    expect(fromPaise(100)).toBe(1)
    expect(fromPaise(0)).toBe(0)
  })
})

describe('addAmounts', () => {
  it('avoids float drift', () => {
    expect(addAmounts(0.1, 0.2)).toBe(0.3)
  })

  it('adds whole amounts correctly', () => {
    expect(addAmounts(50000, 75000)).toBe(125000)
    expect(addAmounts(0, 25000)).toBe(25000)
  })
})

describe('subtractAmounts', () => {
  it('subtracts correctly via paise', () => {
    expect(subtractAmounts(125000, 50000)).toBe(75000)
    expect(subtractAmounts(125000, 125000)).toBe(0)
  })
})

describe('computeTax', () => {
  it('returns zero for 0%', () => {
    expect(computeTax(125000, 0)).toBe(0)
  })

  it('computes 18% tax', () => {
    expect(computeTax(125000, 18)).toBe(22500)
  })

  it('floors fractional tax', () => {
    // 33.33% of 100 = 33.33 → floor to 33
    expect(computeTax(100, 33.33)).toBe(33)
  })
})

describe('formatINR', () => {
  it('formats 0', () => {
    expect(formatINR(0)).toBe('₹0')
  })

  it('formats hundreds', () => {
    expect(formatINR(500)).toBe('₹500')
  })

  it('formats thousands', () => {
    expect(formatINR(1500)).toBe('₹1,500')
  })

  it('formats lakhs (Indian grouping)', () => {
    expect(formatINR(125000)).toBe('₹1,25,000')
  })

  it('formats ten lakhs', () => {
    expect(formatINR(1000000)).toBe('₹10,00,000')
  })

  it('formats crores', () => {
    expect(formatINR(10000000)).toBe('₹1,00,00,000')
  })
})
