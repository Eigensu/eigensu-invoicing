import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { InvoiceRenderData } from './types'

// Brand tokens — single source of truth mirrors packages/config/tailwind.preset.js
const BG = '#d6eaf5'
const BLUE = '#86b9d4'
const DARK = '#1a1a1a'

// Helvetica (Type1/Windows-1252) cannot encode the ₹ glyph — it renders as ¹.
// Replace with the ASCII-safe "Rs." prefix for all currency strings in the PDF.
function rs(s: string): string {
  return s.startsWith('₹') ? 'Rs. ' + s.slice(1) : s
}

const s = StyleSheet.create({
  page: {
    backgroundColor: BG,
    fontFamily: 'Helvetica',
    paddingHorizontal: 40,
    paddingVertical: 40,
    fontSize: 10,
    color: DARK,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hr: {
    height: 1,
    backgroundColor: BLUE,
    marginVertical: 10,
  },
  title: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 1,
  },
  headerRight: {
    textAlign: 'right',
  },
  invoiceNo: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tableHeader: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  descCol: {
    flex: 1,
  },
  amtCol: {
    textAlign: 'right',
    minWidth: 80,
  },
  totalsBox: {
    minWidth: 200,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  grandLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandAmt: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 24,
  },
  footerRight: {
    textAlign: 'right',
  },
})

interface Props {
  data: InvoiceRenderData
}

export function InvoiceDocument({ data }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.row}>
          <Text style={s.title}>Invoice</Text>
          <View style={s.headerRight}>
            {data.company.logoUrl && (
              <Image
                src={data.company.logoUrl}
                style={{ height: 40, alignSelf: 'flex-end', marginBottom: 6, objectFit: 'contain' }}
              />
            )}
            <Text>{data.issueDate}</Text>
            <Text>Invoice No.</Text>
            <Text style={s.invoiceNo}>{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={s.hr} />

        {/* Billed to */}
        <View style={{ marginBottom: 10 }}>
          <Text style={s.label}>Billed to:</Text>
          <Text>{data.client.name}</Text>
          {data.client.contactPerson !== undefined && (
            <Text>{data.client.contactPerson}</Text>
          )}
          <Text>{data.client.phone}</Text>
          <Text>{data.client.billingAddress}</Text>
        </View>

        <View style={s.hr} />

        {/* Line items */}
        <View style={s.row}>
          <Text style={[s.tableHeader, s.descCol]}>Description</Text>
          <Text style={[s.tableHeader, s.amtCol]}>Amount</Text>
        </View>
        <View style={s.hr} />
        {data.lineItems.map((item, i) => (
          <View key={i} style={[s.row, { paddingVertical: 4 }]}>
            <Text style={s.descCol}>{item.description}</Text>
            <Text style={s.amtCol}>{rs(item.amount)}</Text>
          </View>
        ))}

        <View style={s.hr} />

        {/* Amount in words + totals */}
        <View style={[s.row, { alignItems: 'flex-start', marginBottom: 12 }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={s.label}>Invoice Amount (In Words):</Text>
            <Text style={{ fontWeight: 'bold' }}>{data.amountInWords}</Text>
          </View>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text>Subtotal</Text>
              <Text style={{ textAlign: 'right' }}>{rs(data.subtotal)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text>{data.taxLabel}</Text>
              <Text style={{ textAlign: 'right' }}>{rs(data.tax)}</Text>
            </View>
            <View style={s.hr} />
            <View style={s.totalsRow}>
              <Text style={s.grandLabel}>Total</Text>
              <Text style={s.grandAmt}>{rs(data.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.hr} />

        {/* Declaration */}
        <View style={{ marginBottom: 10 }}>
          <Text style={s.label}>Declaration:</Text>
          <Text style={{ lineHeight: 1.4 }}>{data.declarationText}</Text>
        </View>

        <View style={s.hr} />

        {/* Payment info + company */}
        <View style={s.footerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Payment Information</Text>
            <Text>Holder: {data.bankAccount.holderName}</Text>
            <Text>A/C: {data.bankAccount.accountNumber}</Text>
            <Text>IFSC: {data.bankAccount.ifsc}</Text>
            {data.bankAccount.upiId !== undefined && (
              <Text>UPI: {data.bankAccount.upiId}</Text>
            )}
          </View>
          <View style={[{ flex: 1 }, s.footerRight]}>
            <Text style={s.label}>{data.company.name}</Text>
            <Text>{data.company.address}</Text>
            <Text>{data.company.phone}</Text>
            <Text>{data.company.email}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
