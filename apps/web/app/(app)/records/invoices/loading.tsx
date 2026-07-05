import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function RecordsInvoicesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-9 w-96" />
      <TableSkeleton columns={6} rows={7} />
    </div>
  )
}
