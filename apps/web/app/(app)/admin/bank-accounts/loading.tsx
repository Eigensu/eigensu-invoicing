import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function BankAccountsLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton action />
      <TableSkeleton columns={7} rows={4} />
    </div>
  )
}
