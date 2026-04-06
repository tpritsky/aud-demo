import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import * as dbPatients from '@/lib/db/patients'
import * as dbCallbackTasks from '@/lib/db/callback-tasks'
import * as dbScheduledCheckIns from '@/lib/db/scheduled-checkins'
import * as dbActivityEvents from '@/lib/db/activity-events'
import * as dbAgentConfig from '@/lib/db/agent-config'
import * as dbSequences from '@/lib/db/sequences'
import * as dbUtils from '@/lib/db/utils'
import type {
  CallRow,
  PatientRow,
  CallbackTaskRow,
  CallbackAttemptRow,
  ScheduledCheckInRow,
  ActivityEventRow,
  ProactiveSequenceRow,
} from '@/lib/db/types'
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

    async function userIdsInClinic(clinicId: string, fallback: string): Promise<string[]> {
      const { data } = await supabase.from('profiles').select('id').eq('clinic_id', clinicId)
      const ids = (data || []).map((r) => (r as { id: string }).id).filter(Boolean)
      return ids.length > 0 ? ids : [fallback]
    }

    async function patientsForUserIds(userIds: string[]) {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('user-dashboard-data patients:', error)
        return []
      }
      return (data || []).map((row) => dbUtils.dbPatientToApp(row as PatientRow))
    }

    async function callbackTasksForUserIds(userIds: string[]) {
      const { data: taskRows, error: te } = await supabase
        .from('callback_tasks')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
      if (te || !taskRows?.length) return []
      const taskIds = taskRows.map((t) => (t as CallbackTaskRow).id)
      const { data: attRows } = await supabase
        .from('callback_attempts')
        .select('*')
        .in('task_id', taskIds)
        .order('attempt_number', { ascending: true })
      const attemptsByTask = new Map<string, CallbackAttemptRow[]>()
      for (const a of attRows || []) {
        const ar = a as CallbackAttemptRow
        const list = attemptsByTask.get(ar.task_id) || []
        list.push(ar)
        attemptsByTask.set(ar.task_id, list)
      }
      return taskRows.map((t) =>
        dbUtils.dbCallbackTaskToApp(
          t as CallbackTaskRow,
          (attemptsByTask.get((t as CallbackTaskRow).id) || []).map(dbUtils.dbCallbackAttemptToApp)
        )
      )
    }

    async function checkInsForUserIds(userIds: string[]) {
      const { data, error } = await supabase
        .from('scheduled_check_ins')
        .select('*')
        .in('user_id', userIds)
        .order('scheduled_for', { ascending: true })
      if (error) return []
      return (data || []).map((row) => dbUtils.dbScheduledCheckInToApp(row as ScheduledCheckInRow))
    }

    async function activityForUserIds(userIds: string[]) {
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .in('user_id', userIds)
        .order('timestamp', { ascending: false })
        .limit(80)
      if (error) return []
      return (data || []).map((row) => dbUtils.dbActivityEventToApp(row as ActivityEventRow))
    }

    async function sequencesForUserIds(userIds: string[]) {
      const { data, error } = await supabase
        .from('proactive_sequences')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data || []).map((row) => dbUtils.dbSequenceToApp(row as ProactiveSequenceRow))
    }

    const memberUserIds = p.clinic_id ? await userIdsInClinic(p.clinic_id, targetUserId) : [targetUserId]

    const [patients, callsData, tasksData, checkInsData, eventsData, sequences] = await Promise.all([
      p.clinic_id
        ? patientsForUserIds(memberUserIds)
        : dbPatients.getPatients(supabase, targetUserId).catch(() => []),
      callsForTarget().catch(() => []),
      p.clinic_id
        ? callbackTasksForUserIds(memberUserIds)
        : dbCallbackTasks.getCallbackTasks(supabase, targetUserId).catch(() => []),
      p.clinic_id
        ? checkInsForUserIds(memberUserIds)
        : dbScheduledCheckIns.getScheduledCheckIns(supabase, targetUserId).catch(() => []),
      p.clinic_id
        ? activityForUserIds(memberUserIds)
        : dbActivityEvents.getActivityEvents(supabase, targetUserId, 50).catch(() => []),
      p.clinic_id
        ? sequencesForUserIds(memberUserIds)
        : dbSequences.getSequences(supabase, targetUserId).catch(() => []),
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
      profile: {
        role: p.role as 'super_admin' | 'admin' | 'member',
        clinicId: p.clinic_id,
      },
      clinic,
      user: { id: targetUserId, email: (targetProfile as { email: string }).email, full_name: (targetProfile as { full_name: string | null }).full_name },
      patients,
      calls: callsData,
      callbackTasks: tasksData,
      scheduledCheckIns: checkInsData,
      activityEvents: eventsData,
      sequences,
      agentConfig: agentCfg,
    })
  } catch (e) {
    console.error('user-dashboard-data error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
