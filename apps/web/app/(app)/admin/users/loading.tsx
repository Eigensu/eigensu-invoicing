import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function AdminUsersLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton action />
      <TableSkeleton columns={4} rows={5} />
    </div>
  )
}
