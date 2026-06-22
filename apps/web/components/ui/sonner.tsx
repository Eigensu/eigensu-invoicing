'use client'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-slate-500',
        actionButton:
          'group-[.toast]:bg-eigensu-blue group-[.toast]:text-white',
        cancelButton:
          'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500',
      },
    }}
    {...props}
  />
)

export { Toaster }
