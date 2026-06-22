'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string | undefined }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
      {error.digest && (
        <p className="text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
      <Button
        variant="outline"
        onClick={() => {
          router.refresh()
          reset()
        }}
      >
        Retry
      </Button>
    </div>
  )
}
