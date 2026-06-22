import { config } from 'dotenv'
config({ path: '../../.env' })
import { createClient } from '@supabase/supabase-js'
import { db } from './src/client'
import {
  settings,
  bankAccounts,
  reminderRules,
  users,
  clients,
  projects,
  scheduleItems,
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

  // Settings
  await db
    .insert(settings)
    .values({
      companyName: 'Eigensu',
      address: '42 Tech Park, Whitefield, Bengaluru, Karnataka 560066',
      phone: '+91 98765 00000',
      email: 'billing@eigensu.in',
      logoUrl: null,
      defaultTaxPercent: '18',
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

  // Default bank account (test values — replace before going live)
  const [bankAccount] = await db
    .insert(bankAccounts)
    .values({
      holderName: 'Eigensu Solutions Pvt Ltd',
      accountNumber: 'TEST00000001',
      ifsc: 'HDFC0001234',
      upiId: 'eigensu@hdfcbank',
      label: 'HDFC Current (Test)',
      isDefault: true,
    })
    .returning()
  console.log('✓ Bank account')

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

  // Founders
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

  // Demo data
  if (process.env['SEED_DEMO'] === 'true') {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Binge Consulting',
        email: 'billing@bingeconsulting.com',
        contactPerson: 'Demo Contact',
        phone: '[CLIENT_PHONE]',
        billingAddress: '[CLIENT_ADDRESS]',
      })
      .returning()
    if (!client) throw new Error('Failed to insert demo client')

    const [project] = await db
      .insert(projects)
      .values({
        clientId: client.id,
        name: 'Recruitr',
        description: 'Recruitment platform build',
        paymentModel: 'installments',
        totalValue: '150000',
        startDate: new Date().toISOString().split('T')[0]!,
      })
      .returning()
    if (!project) throw new Error('Failed to insert demo project')

    const today = new Date()
    const m1 = new Date(today); m1.setDate(m1.getDate() + 30)
    const m2 = new Date(today); m2.setDate(m2.getDate() + 60)
    const m3 = new Date(today); m3.setDate(m3.getDate() + 90)

    await db.insert(scheduleItems).values([
      {
        projectId: project.id,
        type: 'installment',
        label: '1st Installment — Design & Discovery',
        amount: '50000',
        dueDate: m1.toISOString().split('T')[0]!,
        recurrence: 'none',
      },
      {
        projectId: project.id,
        type: 'installment',
        label: '2nd Installment — Development',
        amount: '60000',
        dueDate: m2.toISOString().split('T')[0]!,
        recurrence: 'none',
      },
      {
        projectId: project.id,
        type: 'installment',
        label: '3rd Installment — Launch & Handover',
        amount: '40000',
        dueDate: m3.toISOString().split('T')[0]!,
        recurrence: 'none',
      },
    ])
    console.log('✓ Demo client + project + schedule items')
    if (bankAccount) {
      console.log('  (bank account available for demo invoices:', bankAccount.id, ')')
    }
  }

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
