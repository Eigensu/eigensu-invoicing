export type PaymentModel = 'one_time' | 'installments' | 'subscription' | 'upfront_amc'
export type ScheduleType = 'one_time' | 'installment' | 'amc' | 'subscription'
export type Recurrence = 'none' | 'monthly' | 'quarterly' | 'yearly'

export interface ScheduleItemDraft {
  type: ScheduleType
  label: string
  amount: number
  dueDate: Date
  recurrence: Recurrence
}

export interface InstallmentInput {
  label: string
  amount: number
  dueDate: Date
}

export interface ProjectConfig {
  paymentModel: PaymentModel
  startDate: Date
  endDate?: Date
  // one_time
  oneTimeDueDate?: Date
  oneTimeAmount?: number
  // installments
  installments?: InstallmentInput[]
  // subscription
  subscriptionAmount?: number
  subscriptionRecurrence?: Recurrence
  // upfront_amc
  upfrontAmount?: number
  upfrontDueDate?: Date
  amcAmount?: number
  amcRecurrence?: Recurrence
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function recurrenceToMonths(r: Recurrence): number {
  switch (r) {
    case 'monthly': return 1
    case 'quarterly': return 3
    case 'yearly': return 12
    default: throw new Error(`Cannot compute months for recurrence: ${r}`)
  }
}

function generateRecurring(
  type: ScheduleType,
  label: string,
  amount: number,
  recurrence: Recurrence,
  firstDate: Date,
  endDate: Date,
): ScheduleItemDraft[] {
  const items: ScheduleItemDraft[] = []
  const monthStep = recurrenceToMonths(recurrence)
  let current = new Date(firstDate)
  let index = 1

  while (current <= endDate) {
    items.push({
      type,
      label: `${label} ${index}`,
      amount,
      dueDate: new Date(current),
      recurrence,
    })
    current = addMonths(current, monthStep)
    index++
  }
  return items
}

export function buildSchedule(config: ProjectConfig): ScheduleItemDraft[] {
  switch (config.paymentModel) {
    case 'one_time': {
      if (config.oneTimeAmount == null || !config.oneTimeDueDate) {
        throw new Error('one_time model requires oneTimeAmount and oneTimeDueDate')
      }
      return [
        {
          type: 'one_time',
          label: 'Payment',
          amount: config.oneTimeAmount,
          dueDate: config.oneTimeDueDate,
          recurrence: 'none',
        },
      ]
    }

    case 'installments': {
      if (!config.installments || config.installments.length === 0) {
        throw new Error('installments model requires at least one installment')
      }
      return config.installments.map((inst, i) => ({
        type: 'installment' as ScheduleType,
        label: inst.label || `Installment ${i + 1}`,
        amount: inst.amount,
        dueDate: inst.dueDate,
        recurrence: 'none' as Recurrence,
      }))
    }

    case 'subscription': {
      if (
        config.subscriptionAmount == null ||
        !config.subscriptionRecurrence ||
        !config.endDate
      ) {
        throw new Error(
          'subscription model requires subscriptionAmount, subscriptionRecurrence, and endDate',
        )
      }
      const firstDate = addMonths(config.startDate, recurrenceToMonths(config.subscriptionRecurrence))
      return generateRecurring(
        'subscription',
        'Subscription',
        config.subscriptionAmount,
        config.subscriptionRecurrence,
        firstDate,
        config.endDate,
      )
    }

    case 'upfront_amc': {
      if (
        config.upfrontAmount == null ||
        !config.upfrontDueDate ||
        config.amcAmount == null ||
        !config.amcRecurrence ||
        !config.endDate
      ) {
        throw new Error(
          'upfront_amc model requires upfrontAmount, upfrontDueDate, amcAmount, amcRecurrence, and endDate',
        )
      }
      const upfront: ScheduleItemDraft = {
        type: 'one_time',
        label: 'Upfront Payment',
        amount: config.upfrontAmount,
        dueDate: config.upfrontDueDate,
        recurrence: 'none',
      }
      const firstAmcDate = addMonths(
        config.upfrontDueDate,
        recurrenceToMonths(config.amcRecurrence),
      )
      const amcItems = generateRecurring(
        'amc',
        'AMC',
        config.amcAmount,
        config.amcRecurrence,
        firstAmcDate,
        config.endDate,
      )
      return [upfront, ...amcItems]
    }
  }
}
