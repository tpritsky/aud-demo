import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import * as dbPatients from '@/lib/db/patients'
import * as dbCallbackTasks from '@/lib/db/callback-tasks'
import * as dbScheduledCheckIns from '@/lib/db/scheduled-checkins'
import * as dbActivityEvents from '@/lib/db/activity-events'
import * as dbAgentConfig from '@/lib/db/agent-config'
import * as dbUtils from '@/lib/db/utils'
import type { CallRow } from '@/lib/db/types'
import { normalizeVertical, parseClinicSettingsBlob } from '@/lib/clinic-call-ai'
import type { AgentConfig } from '@/lib/types'
import {
  clinicAgentConfigEnrichmentChanged,
  enrichClinicSettingsAgentConfig,
} from '@/lib/server/elevenlabs-line-phone'

/**
 * GET /api/super-admin/user-dashboard-data?userId=xxx
 * Returns dashboard data (profile, clinic, patients, calls, etc.) for that user. Super_admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if ((profile as { role?: string } | null)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')?.trim()
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, clinic_id')
      .eq('id', targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const p = targetProfile as { role: string; clinic_id: string | null }
    let clinic: { id: string; name: string; vertical: string } | null = null
    if (p.clinic_id) {
      const { data: c } = await supabase.from('clinics').select('id, name, vertical').eq('id', p.clinic_id).single()
      clinic = c as { id: string; name: string; vertical: string } | null
    }

    const callsForTarget = async () => {
      if (p.clinic_id) {
        const [byClinic, byUser] = await Promise.all([
          supabase
            .from('calls')
            .select('*')
            .eq('clinic_id', p.clinic_id)
            .order('timestamp', { ascending: false })
            .limit(200),
          supabase
            .from('calls')
            .select('*')
            .eq('user_id', targetUserId)
            .is('clinic_id', null)
            .order('timestamp', { ascending: false })
            .limit(100),
        ])
        const merged = new Map<string, CallRow>()
        for (const row of byClinic.data || []) merged.set((row as CallRow).id, row as CallRow)
        for (const row of byUser.data || []) merged.set((row as CallRow).id, row as CallRow)
        return Array.from(merged.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 200)
          .map((row) => dbUtils.dbCallToApp(row))
      }
      const { data } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', targetUserId)
        .order('timestamp', { ascending: false })
        .limit(100)
      return (data || []).map((row) => dbUtils.dbCallToApp(row as CallRow))
    }

    const [patients, callsData, tasksData, checkInsData, eventsData] = await Promise.all([
      dbPatients.getPatients(supabase, targetUserId).catch(() => []),
      callsForTarget().catch(() => []),
      dbCallbackTasks.getCallbackTasks(supabase, targetUserId).catch(() => []),
      dbScheduledCheckIns.getScheduledCheckIns(supabase, targetUserId).catch(() => []),
      dbActivityEvents.getActivityEvents(supabase, targetUserId, 50).catch(() => []),
    ])

    let agentCfg: AgentConfig | null = null
    if (p.clinic_id) {
      const { data: crow } = await supabase.from('clinics').select('settings').eq('id', p.clinic_id).maybeSingle()
      let settingsObj: Record<string, unknown> =
        crow?.settings && typeof crow.settings === 'object'
          ? { ...(crow.settings as Record<string, unknown>) }
          : {}
      const beforeEnrich = { ...settingsObj }
      const enriched = await enrichClinicSettingsAgentConfig(
        settingsObj,
        normalizeVertical(clinic?.vertical)
      )
      if (clinicAgentConfigEnrichmentChanged(beforeEnrich, enriched)) {
        const { error: healErr } = await supabase
          .from('clinics')
          .update({ settings: enriched })
          .eq('id', p.clinic_id)
        if (!healErr) settingsObj = enriched
      }
      agentCfg = parseClinicSettingsBlob(settingsObj).agentConfig ?? null
    }
    if (!agentCfg) {
      agentCfg = await dbAgentConfig.getAgentConfig(supabase, targetUserId).catch(() => null)
    }

    return NextResponse.json({
      profile: { role: p.role as 'admin' | 'member', clinicId: p.clinic_id },
      clinic,
      user: { id: targetUserId, email: (targetProfile as { email: string }).email, full_name: (targetProfile as { full_name: string | null }).full_name },
      patients,
      calls: callsData,
      callbackTasks: tasksData,
      scheduledCheckIns: checkInsData,
      activityEvents: eventsData,
      agentConfig: agentCfg,
    })
  } catch (e) {
    console.error('user-dashboard-data error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
