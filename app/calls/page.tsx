'use client'

import { AppShell } from '@/components/layout/app-shell'
import { CallsTable } from '@/components/calls/calls-table'

export default function CallsPage() {
  return (
    <AppShell title="Calls">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Call History</h2>
          <p className="text-sm text-muted-foreground">
            View and manage all incoming and outgoing calls handled by the AI agent.
          </p>
        </div>
        <CallsTable />
      </div>
    </AppShell>
  )
}
