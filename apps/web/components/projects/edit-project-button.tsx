'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectEditDialog } from './project-edit-dialog'
import type { Project } from '@eigensu/db'

export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <ProjectEditDialog open={open} onOpenChange={setOpen} project={project} />
    </>
  )
}
