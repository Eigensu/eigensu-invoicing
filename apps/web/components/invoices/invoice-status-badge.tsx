import { Badge } from '@/components/ui/badge'

export const INVOICE_STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  draft: 'secondary',
  sent: 'default',
  partial: 'warning',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <Badge variant={INVOICE_STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
}
