import { Skeleton } from '@/components/ui/skeleton'
import { InfoGridSkeleton } from '@/components/ui/loading-skeletons'

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <div className="flex gap-1 rounded-md border border-slate-200 p-1 w-fit">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>

      <InfoGridSkeleton fields={4} columns={2} />
    </div>
  )
}
