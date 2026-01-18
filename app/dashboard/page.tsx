'use client'

import { AppShell } from '@/components/layout/app-shell'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HighRiskPatients } from '@/components/dashboard/high-risk-patients'
import { CreateSequenceDialog } from '@/components/dashboard/create-sequence-dialog'

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* KPI Cards */}
        <KPICards />

        {/* Quick Actions */}
        <div className="flex justify-end">
          <CreateSequenceDialog />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>

          {/* High Risk Patients */}
          <div className="lg:col-span-2">
            <HighRiskPatients />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
