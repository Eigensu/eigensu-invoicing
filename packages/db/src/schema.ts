import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const paymentModelEnum = pgEnum('payment_model', [
  'one_time',
  'installments',
  'subscription',
  'upfront_amc',
])

export const scheduleTypeEnum = pgEnum('schedule_type', [
  'one_time',
  'installment',
  'amc',
  'subscription',
])

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
])

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled',
])

export const recurrenceEnum = pgEnum('recurrence', [
  'none',
  'monthly',
  'quarterly',
  'yearly',
])

export const reminderTypeEnum = pgEnum('reminder_type', [
  'client_due_soon',
  'client_due',
  'client_overdue',
  'internal_alert',
])

export const reminderStatusEnum = pgEnum('reminder_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
])

export const userRoleEnum = pgEnum('user_role', ['admin', 'viewer', 'accountant'])

export const clientStatusEnum = pgEnum('client_status', ['active', 'archived'])

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'completed',
  'archived',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email').notNull(),
  billingAddress: text('billing_address'),
  gstId: text('gst_id'),
  status: clientStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  paymentModel: paymentModelEnum('payment_model').notNull(),
  totalValue: numeric('total_value', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('INR'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  amcAmount: numeric('amc_amount', { precision: 12, scale: 2 }),
  amcRecurrence: recurrenceEnum('amc_recurrence'),
  status: projectStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scheduleItems = pgTable('schedule_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: scheduleTypeEnum('type').notNull(),
  label: text('label').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  recurrence: recurrenceEnum('recurrence').notNull().default('none'),
  status: scheduleStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoiceSequences = pgTable('invoice_sequences', {
  year: integer('year').primaryKey(),
  lastSeq: integer('last_seq').notNull().default(0),
})

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  holderName: text('holder_name').notNull(),
  accountNumber: text('account_number').notNull(),
  ifsc: text('ifsc').notNull(),
  upiId: text('upi_id'),
  label: text('label').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text('invoice_number').notNull().unique(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'restrict' }),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  amountInWords: text('amount_in_words').notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  pdfPath: text('pdf_path'),
  bankAccountId: uuid('bank_account_id')
    .notNull()
    .references(() => bankAccounts.id, { onDelete: 'restrict' }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoiceScheduleItems = pgTable(
  'invoice_schedule_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    scheduleItemId: uuid('schedule_item_id')
      .notNull()
      .references(() => scheduleItems.id, { onDelete: 'restrict' }),
  },
  (t) => [unique('invoice_schedule_items_schedule_item_id_unique').on(t.scheduleItemId)],
)

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dateReceived: date('date_received').notNull(),
  mode: text('mode').notNull().default('bank'), // 'bank' | 'upi' | 'cash' | 'other'
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reminderRules = pgTable('reminder_rules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  type: reminderTypeEnum('type').notNull(),
  offsetDays: integer('offset_days').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  subject: text('subject').notNull(),
  bodyTemplate: text('body_template').notNull(),
  ccFounders: boolean('cc_founders').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => reminderRules.id, { onDelete: 'restrict' }),
    type: reminderTypeEnum('type').notNull(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    scheduledFor: date('scheduled_for').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    status: reminderStatusEnum('status').notNull().default('pending'),
    recipients: text('recipients').array().notNull().default(sql`'{}'::text[]`),
    retryCount: integer('retry_count').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('reminders_invoice_rule_unique').on(t.invoiceId, t.ruleId)],
)

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  companyName: text('company_name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  logoUrl: text('logo_url'),
  defaultTaxPercent: numeric('default_tax_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  defaultCurrency: text('default_currency').notNull().default('INR'),
  invoiceNumberFormat: text('invoice_number_format').notNull().default('XXXX/YY'),
  defaultDueDays: integer('default_due_days').notNull().default(30),
  declarationText: text('declaration_text').notNull(),
  founderEmails: text('founder_emails').array().notNull().default(sql`'{}'::text[]`),
  autoSendRecurring: boolean('auto_send_recurring').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  // null = invited but password not yet set
  passwordHash: text('password_hash'),
  inviteToken: text('invite_token').unique(),
  inviteTokenExpiresAt: timestamp('invite_token_expires_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  invoices: many(invoices),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  scheduleItems: many(scheduleItems),
  invoices: many(invoices),
}))

export const scheduleItemsRelations = relations(scheduleItems, ({ one, many }) => ({
  project: one(projects, { fields: [scheduleItems.projectId], references: [projects.id] }),
  invoiceLinks: many(invoiceScheduleItems),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  bankAccount: one(bankAccounts, {
    fields: [invoices.bankAccountId],
    references: [bankAccounts.id],
  }),
  lineItems: many(invoiceLineItems),
  scheduleItemLinks: many(invoiceScheduleItems),
  payments: many(payments),
  reminders: many(reminders),
}))

export const invoiceScheduleItemsRelations = relations(invoiceScheduleItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceScheduleItems.invoiceId],
    references: [invoices.id],
  }),
  scheduleItem: one(scheduleItems, {
    fields: [invoiceScheduleItems.scheduleItemId],
    references: [scheduleItems.id],
  }),
}))

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}))

export const remindersRelations = relations(reminders, ({ one }) => ({
  invoice: one(invoices, { fields: [reminders.invoiceId], references: [invoices.id] }),
  rule: one(reminderRules, { fields: [reminders.ruleId], references: [reminderRules.id] }),
}))

export const reminderRulesRelations = relations(reminderRules, ({ many }) => ({
  reminders: many(reminders),
}))

// ─── Inferred types ───────────────────────────────────────────────────────────

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type ScheduleItem = typeof scheduleItems.$inferSelect
export type NewScheduleItem = typeof scheduleItems.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceScheduleItem = typeof invoiceScheduleItems.$inferSelect
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type BankAccount = typeof bankAccounts.$inferSelect
export type NewBankAccount = typeof bankAccounts.$inferInsert
export type Reminder = typeof reminders.$inferSelect
export type ReminderRule = typeof reminderRules.$inferSelect
export type Settings = typeof settings.$inferSelect
export type User = typeof users.$inferSelect
export type AuditLog = typeof auditLog.$inferSelect
