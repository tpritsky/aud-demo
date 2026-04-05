'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HighRiskPatients } from '@/components/dashboard/high-risk-patients'
import { CreateSequenceDialog } from '@/components/dashboard/create-sequence-dialog'
import { ReceptionistCallHero } from '@/components/dashboard/receptionist-call-hero'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { defaultAgentConfig } from '@/lib/data'

function DashboardContent() {
  const searchParams = useSearchParams()
  const viewAsUserId = searchParams.get('viewAs')
  const {
    profile,
    sessionAccount,
    viewAs,
    setProfile,
    setPatients,
    setCalls,
    setCallbackTasks,
    setScheduledCheckIns,
    setActivityEvents,
    setAgentConfig,
    setViewAs,
  } = useAppStore()
  const viewAsLoadedRef = useRef<string | null>(null)
  if (!viewAsUserId && viewAsLoadedRef.current) viewAsLoadedRef.current = null

  useEffect(() => {
    // Use real signed-in role: after load, `profile` is swapped to the target and would block re-fetch.
    if (!viewAsUserId || sessionAccount?.role !== 'super_admin' || viewAsLoadedRef.current === viewAsUserId)
      return
    viewAsLoadedRef.current = viewAsUserId
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`/api/super-admin/user-dashboard-data?userId=${encodeURIComponent(viewAsUserId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const displayName = data.user?.full_name || data.user?.email || 'User'
      setProfile({ role: data.profile?.role ?? 'member', clinicId: data.profile?.clinicId ?? null })
      setPatients(data.patients ?? [])
      setCalls(data.calls ?? [])
      setCallbackTasks(data.callbackTasks ?? [])
      setScheduledCheckIns(data.scheduledCheckIns ?? [])
      setActivityEvents(data.activityEvents ?? [])
      setAgentConfig(data.agentConfig ?? { ...defaultAgentConfig, clinicName: data.clinic?.name ?? defaultAgentConfig.clinicName })
      setViewAs({ userId: viewAsUserId, displayName })
    }
    run()
  }, [
    viewAsUserId,
    sessionAccount?.role,
    setProfile,
    setPatients,
    setCalls,
    setCallbackTasks,
    setScheduledCheckIns,
    setActivityEvents,
    setAgentConfig,
    setViewAs,
  ])

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <ReceptionistCallHero />

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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Loading...</div>
      </AppShell>
    }>
      <DashboardContent />
    </Suspense>
  )
}
