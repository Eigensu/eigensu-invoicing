import { PageHeaderSkeleton, FormFieldsSkeleton } from '@/components/ui/loading-skeletons'

export default function NewProjectLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormFieldsSkeleton fields={5} />
    </div>
  )
}
