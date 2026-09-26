import type { InvoiceRenderData } from '@eigensu/invoice'

// The published Brand Template has exactly 6 line-item slots
// (line_item_1_description/amount … line_item_6_description/amount) —
// Canva's Autofill API only fills pre-existing tagged fields, it cannot
// add rows at request time.
export const CANVA_MAX_LINE_ITEMS = 6

export type CanvaAutofillTextData = Record<string, { type: 'text'; text: string }>

export class TooManyLineItemsError extends Error {
  constructor(public readonly count: number) {
    super(
      `Invoice has ${count} line items but the Canva template only supports ${CANVA_MAX_LINE_ITEMS}. ` +
        'Combine line items or generate the PDF without Canva.',
    )
    this.name = 'TooManyLineItemsError'
  }
}

export function buildCanvaAutofillData(data: InvoiceRenderData): CanvaAutofillTextData {
  if (data.lineItems.length > CANVA_MAX_LINE_ITEMS) {
    throw new TooManyLineItemsError(data.lineItems.length)
  }

  const text = (value: string): { type: 'text'; text: string } => ({ type: 'text', text: value })

  const fields: CanvaAutofillTextData = {
    invoice_number_line: text(`Invoice No. ${data.invoiceNumber}`),
    issue_date: text(data.issueDate),
    client_billing_block: text(`${data.client.name}\n${data.client.billingAddress}`),
    company_name: text(data.company.name),
    company_contact_block: text(
      `${data.company.address}\n${data.company.phone}\n${data.company.email}`,
    ),
    bank_details_block: text(
      `Holder Name : ${data.bankAccount.holderName}\n` +
        `Account number : ${data.bankAccount.accountNumber}\n` +
        `IFSC Code : ${data.bankAccount.ifsc}`,
    ),
    upi_id_line: text(data.bankAccount.upiId ? `UPID : ${data.bankAccount.upiId}` : ''),
    subtotal_amount: text(data.subtotal),
    tax_label: text(data.taxLabel),
    tax_amount: text(data.tax),
    total_amount: text(data.total),
    amount_in_words_line: text(`Invoice Amount (In Words):\n${data.amountInWords}`),
    declaration_text: text(data.declarationText),
  }

  for (let i = 0; i < CANVA_MAX_LINE_ITEMS; i++) {
    const slot = i + 1
    const item = data.lineItems[i]
    fields[`line_item_${slot}_description`] = text(item?.description ?? '')
    fields[`line_item_${slot}_amount`] = text(item?.amount ?? '')
  }

  return fields
}
