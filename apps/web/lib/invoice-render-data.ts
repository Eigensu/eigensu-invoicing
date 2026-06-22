import { formatINR } from '@eigensu/core'
import type { InvoiceRenderData } from '@eigensu/invoice'
import type { Invoice, InvoiceLineItem, BankAccount, Client, Settings } from '@eigensu/db'

type InvoiceWithRelations = Invoice & {
  client: Client
  lineItems: InvoiceLineItem[]
  bankAccount: BankAccount
}

export function buildInvoiceRenderData(
  invoice: InvoiceWithRelations,
  settingsRow: Settings,
): InvoiceRenderData {
  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)

  const sub = Number(invoice.subtotal)
  const tax = Number(invoice.tax)
  const taxPercent = sub > 0 ? Math.round((tax / sub) * 100) : 0

  const baseClient = {
    name: invoice.client.name,
    phone: invoice.client.phone ?? '',
    billingAddress: invoice.client.billingAddress ?? '',
  }
  const client: InvoiceRenderData['client'] =
    invoice.client.contactPerson !== null
      ? { ...baseClient, contactPerson: invoice.client.contactPerson }
      : baseClient

  const baseBankAccount = {
    holderName: invoice.bankAccount.holderName,
    accountNumber: invoice.bankAccount.accountNumber,
    ifsc: invoice.bankAccount.ifsc,
  }
  const bankAccount: InvoiceRenderData['bankAccount'] =
    invoice.bankAccount.upiId !== null
      ? { ...baseBankAccount, upiId: invoice.bankAccount.upiId }
      : baseBankAccount

  const baseCompany = {
    name: settingsRow.companyName,
    address: settingsRow.address,
    phone: settingsRow.phone,
    email: settingsRow.email,
  }
  const company: InvoiceRenderData['company'] =
    settingsRow.logoUrl !== null
      ? { ...baseCompany, logoUrl: settingsRow.logoUrl }
      : baseCompany

  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: new Date(invoice.issueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    client,
    lineItems: sorted.map((li) => ({
      description: li.description,
      amount: formatINR(Number(li.amount)),
    })),
    subtotal: formatINR(sub),
    taxLabel: `Tax (${taxPercent}%)`,
    tax: formatINR(tax),
    total: formatINR(Number(invoice.total)),
    amountInWords: invoice.amountInWords,
    bankAccount,
    company,
    declarationText: settingsRow.declarationText,
  }
}
