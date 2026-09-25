import { PageHeaderSkeleton, FormFieldsSkeleton } from '@/components/ui/loading-skeletons'

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeaderSkeleton />
      <FormFieldsSkeleton fields={6} />
    </div>
  )
}
