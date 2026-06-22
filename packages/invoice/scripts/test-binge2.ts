// Calls the real renderInvoicePDF which goes through InvoiceDocument.tsx
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { renderInvoicePDF } from '../src/render.ts'
import { amountToWords } from '../../core/src/number-to-words.ts'
import { formatINR } from '../../core/src/money.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const data = {
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
    'We declare that this invoice shows the actual price of the goods/services described.',
}

console.log('amountToWords(125000):', data.amountInWords)
console.log('formatINR(50000):', formatINR(50000))
console.log('formatINR(125000):', formatINR(125000))

renderInvoicePDF(data).then((buf) => {
  const outPath = join(__dirname, 'binge-test2.pdf')
  writeFileSync(outPath, buf)
  console.log(`PDF written to ${outPath} (${buf.byteLength} bytes)`)
})
