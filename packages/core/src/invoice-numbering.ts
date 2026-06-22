export function formatInvoiceNumber(
  seq: number,
  year: number,
  format: string,
): string {
  const yy = String(year).slice(-2)
  // XXXX = zero-padded 4-digit sequence; YY = 2-digit year
  return format
    .replace('XXXX', String(seq).padStart(4, '0'))
    .replace('YY', yy)
}
