import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function RecordsProjectsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <TableSkeleton columns={5} rows={6} />
    </div>
  )
}
