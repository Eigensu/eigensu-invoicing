import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function AuditLogLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
        <Skeleton className="h-8 w-16" />
      </div>
      <TableSkeleton columns={5} rows={8} />
    </div>
  )
}
