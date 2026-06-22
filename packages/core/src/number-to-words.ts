const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

function twoDigits(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ones[n] ?? ''
  const t = tens[Math.floor(n / 10)] ?? ''
  const o = ones[n % 10] ?? ''
  return o ? `${t} ${o}` : t
}

function threeDigits(n: number): string {
  if (n === 0) return ''
  const h = Math.floor(n / 100)
  const rem = n % 100
  const hundredPart = h > 0 ? `${ones[h]} Hundred` : ''
  const remPart = twoDigits(rem)
  if (hundredPart && remPart) return `${hundredPart} ${remPart}`
  return hundredPart || remPart
}

export function amountToWords(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(
      `amountToWords only accepts whole rupees, received: ${amount}`,
    )
  }

  if (amount === 0) return 'Zero Only'
  if (amount < 0) throw new Error('amountToWords does not support negative values')

  // Indian grouping: crore (10^7), lakh (10^5), thousand (10^3), rest
  const crore = Math.floor(amount / 10_000_000)
  const lakh = Math.floor((amount % 10_000_000) / 100_000)
  const thousand = Math.floor((amount % 100_000) / 1_000)
  const remainder = amount % 1_000

  const parts: string[] = []
  if (crore > 0) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`)
  if (remainder > 0) parts.push(threeDigits(remainder))

  return `${parts.join(' ')} Only`
}
