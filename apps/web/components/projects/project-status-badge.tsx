import { Badge } from '@/components/ui/badge'

export const PROJECT_STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  active: 'default',
  completed: 'success',
  archived: 'secondary',
}

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
  )
}
