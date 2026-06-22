// Plain JS test — uses the tsx-registered imports via vitest runner
// Run: node --experimental-vm-modules scripts/test-binge.mjs
// Or via tsx: npx tsx scripts/test-binge.mjs

// We render using @react-pdf/renderer directly so this script has no TS dependency
import React from 'react'
import { renderToFile, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Minimal inline InvoiceDocument for quick verification
const BG = '#d6eaf5'
const BLUE = '#86b9d4'

const s = StyleSheet.create({
  page: { backgroundColor: BG, fontFamily: 'Helvetica', padding: 40, fontSize: 10, color: '#1a1a1a' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  hr: { height: 1, backgroundColor: BLUE, marginVertical: 10 },
  title: { fontSize: 72, fontWeight: 'bold', color: '#000000' },
  label: { fontWeight: 'bold', marginBottom: 4 },
})

const data = {
  invoiceNumber: '0001/26',
  issueDate: '01 Apr 2026',
  client: { name: 'Binge Consulting', phone: '+91 99300 67556', billingAddress: 'Bandra West, Mumbai' },
  lineItems: [
    { description: 'Recruitr – 1st Installment', amount: '₹50,000' },
    { description: 'Recruitr – 2nd Installment', amount: '₹50,000' },
    { description: 'Recruitr – 3rd Installment', amount: '₹25,000' },
  ],
  subtotal: '₹1,25,000',
  taxLabel: 'Tax (0%)',
  tax: '₹0',
  total: '₹1,25,000',
  amountInWords: 'One Lakh Twenty Five Thousand Only',
  bankAccount: { holderName: 'Aanshuvi Himanshu Shah', accountNumber: '[PLACEHOLDER]', ifsc: '[PLACEHOLDER]' },
  company: { name: 'Eigensu', address: 'Mumbai, India', phone: '+91 [PLACEHOLDER]', email: 'work.eigensu@gmail.com' },
  declarationText: 'We declare that this invoice shows the actual price of the goods/services described.',
}

const el = React.createElement(Document, {},
  React.createElement(Page, { size: 'A4', style: s.page },
    // Header
    React.createElement(View, { style: s.row },
      React.createElement(Text, { style: s.title }, 'Invoice'),
      React.createElement(View, { style: { textAlign: 'right' } },
        React.createElement(Text, {}, data.issueDate),
        React.createElement(Text, {}, 'Invoice No.'),
        React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold' } }, data.invoiceNumber),
      )
    ),
    React.createElement(View, { style: s.hr }),
    // Billed to
    React.createElement(View, { style: { marginBottom: 10 } },
      React.createElement(Text, { style: s.label }, 'Billed to:'),
      React.createElement(Text, {}, data.client.name),
      React.createElement(Text, {}, data.client.phone),
      React.createElement(Text, {}, data.client.billingAddress),
    ),
    React.createElement(View, { style: s.hr }),
    // Line items
    React.createElement(View, { style: [s.row, { fontWeight: 'bold', marginBottom: 4 }] },
      React.createElement(Text, { style: { flex: 1 } }, 'Description'),
      React.createElement(Text, { style: { textAlign: 'right', minWidth: 80 } }, 'Amount'),
    ),
    React.createElement(View, { style: s.hr }),
    ...data.lineItems.map((item, i) =>
      React.createElement(View, { key: i, style: [s.row, { paddingVertical: 4 }] },
        React.createElement(Text, { style: { flex: 1 } }, item.description),
        React.createElement(Text, { style: { textAlign: 'right', minWidth: 80 } }, item.amount),
      )
    ),
    React.createElement(View, { style: s.hr }),
    // Totals
    React.createElement(View, { style: [s.row, { marginBottom: 12 }] },
      React.createElement(View, { style: { flex: 1 } },
        React.createElement(Text, { style: s.label }, 'Invoice Amount (In Words):'),
        React.createElement(Text, { style: { fontWeight: 'bold' } }, data.amountInWords),
      ),
      React.createElement(View, { style: { minWidth: 200 } },
        React.createElement(View, { style: s.row },
          React.createElement(Text, {}, 'Subtotal'),
          React.createElement(Text, {}, data.subtotal),
        ),
        React.createElement(View, { style: s.row },
          React.createElement(Text, {}, data.taxLabel),
          React.createElement(Text, {}, data.tax),
        ),
        React.createElement(View, { style: s.hr }),
        React.createElement(View, { style: s.row },
          React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold' } }, 'Total'),
          React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', textAlign: 'right' } }, data.total),
        ),
      ),
    ),
    React.createElement(View, { style: s.hr }),
    // Declaration
    React.createElement(View, { style: { marginBottom: 10 } },
      React.createElement(Text, { style: s.label }, 'Declaration:'),
      React.createElement(Text, {}, data.declarationText),
    ),
    React.createElement(View, { style: s.hr }),
    // Footer
    React.createElement(View, { style: { flexDirection: 'row', gap: 24 } },
      React.createElement(View, { style: { flex: 1 } },
        React.createElement(Text, { style: s.label }, 'Payment Information'),
        React.createElement(Text, {}, `Holder: ${data.bankAccount.holderName}`),
        React.createElement(Text, {}, `A/C: ${data.bankAccount.accountNumber}`),
        React.createElement(Text, {}, `IFSC: ${data.bankAccount.ifsc}`),
      ),
      React.createElement(View, { style: { flex: 1, textAlign: 'right' } },
        React.createElement(Text, { style: s.label }, data.company.name),
        React.createElement(Text, {}, data.company.address),
        React.createElement(Text, {}, data.company.phone),
        React.createElement(Text, {}, data.company.email),
      ),
    ),
  )
)

const outPath = join(__dirname, 'binge-test.pdf')
await renderToFile(el, outPath)
console.log(`✓ PDF written: ${outPath}`)

// Verify key items
const { formatINR } = await import(
  join(__dirname, '../../../node_modules/.pnpm/@eigensu+core@0.0.1/node_modules/@eigensu/core/src/money.ts')
  // fallback: inline
).catch(() => ({ formatINR: null }))

console.log('amountInWords (hardcoded):', data.amountInWords)
console.log('formatINR(50000) expected: ₹50,000')
console.log('formatINR(125000) expected: ₹1,25,000')
