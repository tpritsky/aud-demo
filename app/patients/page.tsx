'use client'

import { AppShell } from '@/components/layout/app-shell'
import { PatientsTable } from '@/components/patients/patients-table'

export default function PatientsPage() {
  return (
    <AppShell title="Patients">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Patient Directory</h2>
          <p className="text-sm text-muted-foreground">
            View and manage patient information, adoption signals, and check-in schedules.
          </p>
        </div>
        <PatientsTable />
      </div>
    </AppShell>
  )
}
