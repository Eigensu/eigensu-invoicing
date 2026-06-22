'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  q?: string
  status?: string
}

export function ClientFilters({ q, status }: Props) {
  const router = useRouter()
  const showArchived = status === 'archived'

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const query = (fd.get('q') as string).trim()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (showArchived) params.set('status', 'archived')
    router.push(`/clients?${params.toString()}`)
  }

  function statusHref(s: 'active' | 'archived') {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (s === 'archived') params.set('status', 'archived')
    return `/clients?${params.toString()}`
  }

  return (
    <div className="flex items-center gap-3">
      <form onSubmit={handleSearch} className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="pl-9 w-64"
        />
      </form>
      <div className="flex gap-1 rounded-md border border-slate-200 p-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(!showArchived && 'bg-white shadow-sm text-eigensu-blue')}
        >
          <a href={statusHref('active')}>Active</a>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(showArchived && 'bg-white shadow-sm text-eigensu-blue')}
        >
          <a href={statusHref('archived')}>Archived</a>
        </Button>
      </div>
    </div>
  )
}
