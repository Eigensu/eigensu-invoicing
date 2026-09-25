import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/components/ui/loading-skeletons'

export default function EmailLoading() {
  return (
    <div className="max-w-xl space-y-6">
      <PageHeaderSkeleton />
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
