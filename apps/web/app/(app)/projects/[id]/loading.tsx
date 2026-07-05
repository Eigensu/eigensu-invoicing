import { Skeleton } from '@/components/ui/skeleton'
import { InfoGridSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <InfoGridSkeleton fields={4} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <TableSkeleton columns={4} rows={5} />
      </div>
    </div>
  )
}
