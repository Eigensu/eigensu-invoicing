import type { ReactNode } from 'react'

interface Props {
  heading: string
  body?: string | undefined
  cta?: ReactNode | undefined
}

export function EmptyState({ heading, body, cta }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center">
      <p className="text-sm font-medium text-slate-700">{heading}</p>
      {body && <p className="mt-1 text-xs text-slate-500">{body}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}
