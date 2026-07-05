import { Skeleton } from '@/components/ui/skeleton'

export function PageHeaderSkeleton({ action }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  )
}

export function TableSkeleton({
  columns = 5,
  rows = 6,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex gap-6 border-b border-slate-100 bg-slate-50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

export function ChartBlockSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <Skeleton className="h-4 w-56" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  )
}

export function InfoGridSkeleton({
  fields = 4,
  columns = 4,
}: {
  fields?: number
  columns?: number
}) {
  const gridClass = columns === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className={`grid gap-x-8 gap-y-4 ${gridClass}`}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormFieldsSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}

export function FilterBarSkeleton({ width = 'w-64' }: { width?: string }) {
  return <Skeleton className={`h-9 ${width}`} />
}
