import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function RecordsPaymentsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <TableSkeleton columns={7} rows={7} />
    </div>
  )
}
