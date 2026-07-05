import { Skeleton } from '@/components/ui/skeleton'
import { StatCardsSkeleton, ChartBlockSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>

      <StatCardsSkeleton />
      <ChartBlockSkeleton />
      <ChartBlockSkeleton height="h-48" />

      <div className="grid gap-6 lg:grid-cols-2">
        <TableSkeleton columns={4} rows={5} />
        <TableSkeleton columns={4} rows={5} />
      </div>

      <TableSkeleton columns={4} rows={5} />
    </div>
  )
}
