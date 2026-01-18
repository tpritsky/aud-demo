'use client'

import { AppShell } from '@/components/layout/app-shell'
import { TasksTable } from '@/components/tasks/tasks-table'

export default function TasksPage() {
  return (
    <AppShell title="Callback Tasks">
      <TasksTable />
    </AppShell>
  )
}
