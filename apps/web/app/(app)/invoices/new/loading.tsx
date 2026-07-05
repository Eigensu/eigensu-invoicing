import { Skeleton } from '@/components/ui/skeleton'
import { FormFieldsSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function NewInvoiceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-36" />
      <FormFieldsSkeleton fields={4} />
      <TableSkeleton columns={3} rows={3} />
    </div>
  )
}
