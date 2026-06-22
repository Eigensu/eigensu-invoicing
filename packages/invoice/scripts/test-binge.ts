// One-shot test script — run with: node --import tsx/esm scripts/test-binge.ts
// Generates a test PDF with Binge Consulting sample data and writes to /tmp/binge-test.pdf
import { writeFileSync } from 'fs'
import { join } from 'path'
import { renderInvoicePDF } from '../src/render'
import { amountToWords, formatINR } from '@eigensu/core'

const binge = {
  invoiceNumber: '0001/26',
  issueDate: '01 Apr 2026',
  dueDate: '15 Apr 2026',
  client: {
    name: 'Binge Consulting',
    phone: '+91 99300 67556',
    billingAddress: 'Bandra West, Mumbai',
  },
  lineItems: [
    { description: 'Recruitr – 1st Installment', amount: formatINR(50000) },
    { description: 'Recruitr – 2nd Installment', amount: formatINR(50000) },
    { description: 'Recruitr – 3rd Installment', amount: formatINR(25000) },
  ],
  subtotal: formatINR(125000),
  taxLabel: 'Tax (0%)',
  tax: formatINR(0),
  total: formatINR(125000),
  amountInWords: amountToWords(125000),
  bankAccount: {
    holderName: 'Aanshuvi Himanshu Shah',
    accountNumber: '[PLACEHOLDER]',
    ifsc: '[PLACEHOLDER]',
  },
  company: {
    name: 'Eigensu',
    address: 'Mumbai, India',
    phone: '+91 [PLACEHOLDER]',
    email: 'work.eigensu@gmail.com',
  },
  declarationText:
    'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.',
}

console.log('amountToWords(125000):', binge.amountInWords)
console.log('formatINR(50000):', formatINR(50000))
console.log('formatINR(125000):', formatINR(125000))

const buf = await renderInvoicePDF(binge)
const outPath = join(import.meta.dirname, 'binge-test.pdf')
writeFileSync(outPath, buf)
console.log(`PDF written to ${outPath} (${buf.byteLength} bytes)`)
