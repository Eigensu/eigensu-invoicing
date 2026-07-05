import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function RecordsClientsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-9 w-72" />
      <TableSkeleton columns={5} rows={6} />
    </div>
  )
}
