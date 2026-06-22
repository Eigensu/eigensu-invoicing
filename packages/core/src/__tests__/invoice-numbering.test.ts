import { describe, it, expect } from 'vitest'
import { formatInvoiceNumber } from '../invoice-numbering'

describe('formatInvoiceNumber', () => {
  it('formats seq 1 for 2026', () => {
    expect(formatInvoiceNumber(1, 2026, 'XXXX/YY')).toBe('0001/26')
  })

  it('formats seq 7 for 2026', () => {
    expect(formatInvoiceNumber(7, 2026, 'XXXX/YY')).toBe('0007/26')
  })

  it('formats seq 100 for 2026', () => {
    expect(formatInvoiceNumber(100, 2026, 'XXXX/YY')).toBe('0100/26')
  })

  it('formats seq 9999 for 2026', () => {
    expect(formatInvoiceNumber(9999, 2026, 'XXXX/YY')).toBe('9999/26')
  })

  it('handles new year (2030)', () => {
    expect(formatInvoiceNumber(1, 2030, 'XXXX/YY')).toBe('0001/30')
  })

  it('uses correct 2-digit year', () => {
    expect(formatInvoiceNumber(1, 2099, 'XXXX/YY')).toBe('0001/99')
  })
})
