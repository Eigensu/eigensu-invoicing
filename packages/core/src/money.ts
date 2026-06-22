export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function fromPaise(paise: number): number {
  return paise / 100
}

export function addAmounts(a: number, b: number): number {
  return fromPaise(toPaise(a) + toPaise(b))
}

export function subtractAmounts(a: number, b: number): number {
  return fromPaise(toPaise(a) - toPaise(b))
}

export function computeTax(subtotal: number, taxPercent: number): number {
  // Returns whole rupees (floor to avoid charging more than stated)
  return Math.floor(fromPaise(toPaise(subtotal) * taxPercent) / 100)
}

export function formatINR(amount: number): string {
  if (amount === 0) return '₹0'

  // Indian grouping: last 3 digits, then pairs
  const [intPart = '0', decPart] = amount.toFixed(2).split('.')
  const lastThree = intPart.slice(-3)
  const remaining = intPart.slice(0, -3)
  const grouped =
    remaining.length > 0
      ? remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree

  // Drop trailing .00
  const suffix = decPart && decPart !== '00' ? `.${decPart}` : ''
  return `₹${grouped}${suffix}`
}
