export interface InvoiceRenderData {
  invoiceNumber: string
  issueDate: string           // "15 Jun 2026"
  dueDate: string
  client: {
    name: string
    contactPerson?: string
    phone: string
    billingAddress: string
  }
  lineItems: Array<{
    description: string
    amount: string            // pre-formatted "₹X,XX,XXX"
  }>
  subtotal: string
  taxLabel: string            // "Tax (0%)" or "Tax (18%)"
  tax: string
  total: string
  amountInWords: string
  bankAccount: {
    holderName: string
    accountNumber: string
    ifsc: string
    upiId?: string
  }
  company: {
    name: string
    address: string
    phone: string
    email: string
    logoUrl?: string
  }
  declarationText: string
}
