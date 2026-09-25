import type { ComponentType, ReactNode } from 'react'

interface Props {
  heading: string
  body?: string | undefined
  cta?: ReactNode | undefined
  icon?: ComponentType<{ className?: string }> | undefined
}

export function EmptyState({ heading, body, cta, icon: Icon }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center">
      {Icon && <Icon className="mx-auto h-8 w-8 text-slate-300 mb-2" />}
      <p className="text-sm font-medium text-slate-700">{heading}</p>
      {body && <p className="mt-1 text-xs text-slate-500">{body}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}
