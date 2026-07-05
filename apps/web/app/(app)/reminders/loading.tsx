import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function RemindersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-8 w-80" />
      <TableSkeleton columns={7} rows={7} />
    </div>
  )
}
