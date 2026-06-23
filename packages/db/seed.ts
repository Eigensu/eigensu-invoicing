import { config } from 'dotenv'
config({ path: '../../.env' })
import { createClient } from '@supabase/supabase-js'
import { db } from './src/client'
import {
  settings,
  reminderRules,
  users,
} from './src/schema'

const supabaseAdmin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function inviteFounder(email: string, name: string) {
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name },
  })
  if (error && !error.message.includes('already')) {
    console.warn(`Warning inviting ${email}:`, error.message)
  }
}

async function main() {
  console.log('Seeding database...')

  // Base settings — fill in company details via Admin → Settings after first login
  await db
    .insert(settings)
    .values({
      companyName: 'Eigensu',
      defaultTaxPercent: '0',
      defaultCurrency: 'INR',
      invoiceNumberFormat: 'XXXX/YY',
      defaultDueDays: 30,
      declarationText:
        'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.',
      founderEmails: ['work.eigensu@gmail.com'],
      autoSendRecurring: false,
    })
    .onConflictDoNothing()
  console.log('✓ Settings')

  // Reminder rules
  await db
    .insert(reminderRules)
    .values([
      {
        type: 'client_due_soon',
        offsetDays: -7,
        enabled: true,
        ccFounders: false,
        sortOrder: 1,
        subject: 'Reminder: Invoice {{invoiceNumber}} due in {{daysUntilDue}} days',
        bodyTemplate:
          'Dear {{clientName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{companyName}}',
      },
      {
        type: 'client_due',
        offsetDays: 0,
        enabled: true,
        ccFounders: false,
        sortOrder: 2,
        subject: 'Invoice {{invoiceNumber}} is due today',
        bodyTemplate:
          'Dear {{clientName}},\n\nInvoice {{invoiceNumber}} for {{amount}} is due today.\n\nPlease arrange payment today to avoid any delays.\n\nRegards,\n{{companyName}}',
      },
      {
        type: 'client_overdue',
        offsetDays: 7,
        enabled: true,
        ccFounders: false,
        sortOrder: 3,
        subject: 'Overdue: Invoice {{invoiceNumber}}',
        bodyTemplate:
          'Dear {{clientName}},\n\nInvoice {{invoiceNumber}} for {{amount}} is {{daysOverdue}} days overdue. Outstanding balance: {{outstanding}}.\n\nPlease arrange payment immediately.\n\nRegards,\n{{companyName}}',
      },
      {
        type: 'client_overdue',
        offsetDays: 15,
        enabled: true,
        ccFounders: true,
        sortOrder: 4,
        subject: 'Second notice: Invoice {{invoiceNumber}} is overdue',
        bodyTemplate:
          'Dear {{clientName}},\n\nThis is a second notice. Invoice {{invoiceNumber}} for {{amount}} is {{daysOverdue}} days overdue. Outstanding balance: {{outstanding}}.\n\nImmediate payment is required.\n\nRegards,\n{{companyName}}',
      },
      {
        type: 'internal_alert',
        offsetDays: 30,
        enabled: true,
        ccFounders: true,
        sortOrder: 5,
        subject: 'Action required: {{overdueCount}} invoices overdue 30+ days',
        bodyTemplate:
          'Hi,\n\nThere are {{overdueCount}} invoices overdue by 30 or more days.\nTotal outstanding: {{totalOutstanding}}.\n\n{{invoiceRows}}\n\nPlease follow up immediately.',
      },
    ])
    .onConflictDoNothing()
  console.log('✓ Reminder rules')

  // Admin user — add your own details here before running
  const founderData = [
    { email: 'work.eigensu@gmail.com', name: 'Aanshuvi Shah' },
  ]
  for (const founder of founderData) {
    await db
      .insert(users)
      .values({ id: crypto.randomUUID(), email: founder.email, name: founder.name, role: 'admin' })
      .onConflictDoNothing()
    await inviteFounder(founder.email, founder.name)
  }
  console.log('✓ Users + invites sent')

  console.log('\nSeed complete.')
  console.log('Next: log in and go to Admin → Settings to fill in company info and bank account.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
