import { FormFieldsSkeleton, PageHeaderSkeleton } from '@/components/ui/loading-skeletons'

export default function NewEngagementLoading() {
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeaderSkeleton />
      <FormFieldsSkeleton fields={5} />
    </div>
  )
}
