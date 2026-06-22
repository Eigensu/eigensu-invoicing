import { Resend } from 'resend'

const resend = new Resend(process.env['RESEND_API_KEY'])
const FROM = process.env['EMAIL_FROM'] ?? 'Eigensu <contact@eigensu.in>'

export interface InvoiceEmailPayload {
  to: string
  invoiceId: string
  invoiceNumber: string
  clientName: string
  amount: string
  dueDate: string
  companyName: string
  companyEmail: string
  companyPhone: string
  bankAccount: { holderName: string; accountNumber: string; ifsc: string }
  cc?: string[]
  pdfBuffer?: Buffer
}

export async function sendInvoiceEmail(payload: InvoiceEmailPayload): Promise<void> {
  const subject = `Invoice ${payload.invoiceNumber} from ${payload.companyName}`
  const html = buildInvoiceHtml(payload)
  const text = `Invoice ${payload.invoiceNumber} for ${payload.amount}, due ${payload.dueDate}. Contact ${payload.companyEmail}.`

  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject,
    html,
    text,
    ...(payload.cc?.length ? { cc: payload.cc } : {}),
    ...(payload.pdfBuffer
      ? {
          attachments: [
            {
              filename: `Invoice-${payload.invoiceNumber.replace('/', '-')}.pdf`,
              content: payload.pdfBuffer,
            },
          ],
        }
      : {}),
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}

export interface ReminderEmailPayload {
  to: string
  subject: string
  htmlBody: string
  cc?: string[]
}

export async function sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.htmlBody,
    text: payload.subject,
    ...(payload.cc?.length ? { cc: payload.cc } : {}),
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

export interface AlertEmailPayload {
  to: string[]
  subject: string
  htmlBody: string
}

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.htmlBody,
    text: payload.subject,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

function buildInvoiceHtml(payload: InvoiceEmailPayload): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#86b9d4">Invoice ${payload.invoiceNumber}</h2>
  <p>Dear ${payload.clientName},</p>
  <p>Please find attached invoice <strong>${payload.invoiceNumber}</strong> for <strong>${payload.amount}</strong>, due on <strong>${payload.dueDate}</strong>.</p>
  <table style="border-collapse:collapse;margin:16px 0;width:100%">
    <tr style="background:#d6eaf5">
      <td style="padding:8px;font-weight:bold">Payment to</td>
      <td style="padding:8px">${payload.bankAccount.holderName}</td>
    </tr>
    <tr>
      <td style="padding:8px;font-weight:bold">Account</td>
      <td style="padding:8px">${payload.bankAccount.accountNumber}</td>
    </tr>
    <tr style="background:#d6eaf5">
      <td style="padding:8px;font-weight:bold">IFSC</td>
      <td style="padding:8px">${payload.bankAccount.ifsc}</td>
    </tr>
  </table>
  <p>For any queries, please contact us at <a href="mailto:${payload.companyEmail}">${payload.companyEmail}</a> or ${payload.companyPhone}.</p>
  <p>Regards,<br/><strong>${payload.companyName}</strong></p>
</body>
</html>`
}
