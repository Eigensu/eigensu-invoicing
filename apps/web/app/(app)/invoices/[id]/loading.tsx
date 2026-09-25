import { Skeleton } from '@/components/ui/skeleton'
import { InfoGridSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function InvoiceDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <InfoGridSkeleton fields={4} />
      <TableSkeleton columns={2} rows={4} />

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}
