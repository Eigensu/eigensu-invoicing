import { describe, it, expect } from 'vitest'
import { amountToWords } from '../number-to-words'

describe('amountToWords', () => {
  it('returns Zero Only for 0', () => {
    expect(amountToWords(0)).toBe('Zero Only')
  })

  it('handles hundreds', () => {
    expect(amountToWords(500)).toBe('Five Hundred Only')
  })

  it('handles thousands and hundreds', () => {
    expect(amountToWords(1500)).toBe('One Thousand Five Hundred Only')
  })

  it('handles twenty-five thousand — spells Five correctly', () => {
    expect(amountToWords(25000)).toBe('Twenty Five Thousand Only')
    // Explicitly check no "Fife" anywhere
    expect(amountToWords(25000)).not.toContain('Fife')
  })

  it('handles fifty thousand', () => {
    expect(amountToWords(50000)).toBe('Fifty Thousand Only')
  })

  it('handles one lakh twenty five thousand', () => {
    expect(amountToWords(125000)).toBe('One Lakh Twenty Five Thousand Only')
  })

  it('handles one crore', () => {
    expect(amountToWords(10000000)).toBe('One Crore Only')
  })

  it('handles one crore fifty lakh', () => {
    expect(amountToWords(15000000)).toBe('One Crore Fifty Lakh Only')
  })

  it('throws for non-integer input', () => {
    expect(() => amountToWords(125000.5)).toThrow('amountToWords only accepts whole rupees')
  })

  it('throws for negative input', () => {
    expect(() => amountToWords(-1)).toThrow()
  })
})
