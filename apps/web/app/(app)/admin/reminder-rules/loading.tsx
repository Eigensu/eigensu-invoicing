import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function ReminderRulesLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <TableSkeleton columns={6} rows={5} />
    </div>
  )
}
