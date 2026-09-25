import { config } from 'dotenv'
config({ path: '../../.env' })
import { hash } from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { db } from './src/client'
import {
  settings,
  reminderRules,
  bankAccounts,
  users,
} from './src/schema'

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function countRows(table: typeof settings | typeof reminderRules | typeof bankAccounts | typeof users) {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table)
  return row?.count ?? 0
}

async function main() {
  console.log('Seeding database...')

  // Settings — single well-known row; insert only if the table is empty
  if ((await countRows(settings)) === 0) {
    await db.insert(settings).values({
      companyName: 'Eigensu',
      address: 'Bengaluru, Karnataka',
      phone: '+91 00000 00000',
      email: 'contact@eigensu.in',
      defaultTaxPercent: '0',
      defaultCurrency: 'INR',
      invoiceNumberFormat: 'XXXX/YY',
      defaultDueDays: 30,
      declarationText:
        'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.',
      founderEmails: ['work.eigensu@gmail.com'],
      autoSendRecurring: false,
    })
    console.log('✓ Settings (created)')
  } else {
    console.log('- Settings already present, skipped')
  }

  // Reminder rules — skip entirely if any rules already exist
  if ((await countRows(reminderRules)) === 0) {
    await db.insert(reminderRules).values([
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
    console.log('✓ Reminder rules (created)')
  } else {
    console.log('- Reminder rules already present, skipped')
  }

  // Bank account — insert the default account only if none exists.
  // Placeholder values: edit via Admin → Bank Accounts after first login.
  if ((await countRows(bankAccounts)) === 0) {
    await db.insert(bankAccounts).values({
      holderName: 'Eigensu',
      accountNumber: '0000000000',
      ifsc: 'XXXX0000000',
      label: 'Primary Account',
      isDefault: true,
    })
    console.log('✓ Bank account (created — fill in real details via Admin → Bank Accounts)')
  } else {
    console.log('- Bank account already present, skipped')
  }

  // Founders — skip any email that already exists. With SEED_FOUNDER_PASSWORD
  // set, the password is seeded directly; otherwise a set-password URL is printed.
  const founderData = [
    { email: 'work.eigensu@gmail.com', name: 'Aanshuvi Shah' },
    // Add the second founder's { email, name } here before running the seed.
  ]
  const seedPassword = process.env['SEED_FOUNDER_PASSWORD']
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  for (const founder of founderData) {
    const email = founder.email.toLowerCase()
    const inviteToken = crypto.randomUUID()

    const [inserted] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email,
        name: founder.name,
        role: 'admin',
        ...(seedPassword
          ? { passwordHash: await hash(seedPassword, 12) }
          : {
              inviteToken,
              inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
            }),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id })

    if (!inserted) {
      console.log(`- User ${email} already present, skipped`)
    } else if (seedPassword) {
      console.log(`✓ User ${email} (password from SEED_FOUNDER_PASSWORD)`)
    } else {
      console.log(`✓ User ${email} — set password at:`)
      console.log(`  ${appUrl}/set-password?token=${inviteToken}`)
    }
  }

  console.log('\nRow counts:')
  console.log(`  settings:       ${await countRows(settings)}`)
  console.log(`  reminder_rules: ${await countRows(reminderRules)}`)
  console.log(`  bank_accounts:  ${await countRows(bankAccounts)}`)
  console.log(`  users:          ${await countRows(users)}`)

  console.log('\nSeed complete. Running it again is a no-op (idempotent).')
  console.log('Next: log in and go to Admin → Settings to fill in company info and bank account.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
