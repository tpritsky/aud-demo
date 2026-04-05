import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertCallerIsSuperAdmin } from '@/lib/server/super-admin-auth'
import {
  ALLOWED_CLINIC_VERTICALS,
  applyAgentClinicFactsPatch,
  applyAgentUiPatch,
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
  sanitizeCallAiIncomingPatch,
  sanitizeCallLogSavedViews,
} from '@/lib/clinic-call-ai'
import type { CallLogSavedView, ClinicCallAiSettings } from '@/lib/types'
import { mergeVoiceCallFlow } from '@/lib/voice-call-flow'
import { ensureConvaiInboundLineAssignedToClinicAgent } from '@/lib/server/elevenlabs-assign-phone'
import {
  clinicAgentConfigEnrichmentChanged,
  enrichClinicSettingsAgentConfig,
} from '@/lib/server/elevenlabs-line-phone'

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get('Authorization')
  return h?.replace(/^Bearer\s+/i, '') || null
}

/**
 * GET/PATCH /api/super-admin/user-clinic-settings?userId=<target auth user id>
 * Same payload as /api/clinic/settings but for the target user's clinic (super_admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

    const targetUserId = new URL(request.url).searchParams.get('userId')?.trim()
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 })
    }

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('clinic_id, role, settings')
      .eq('id', targetUserId)
      .maybeSingle()

    if (pErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const clinicId = (profile as { clinic_id?: string | null }).clinic_id
    const role = (profile as { role?: string }).role
    let personalCallLogSavedViews: CallLogSavedView[] = []
    try {
      personalCallLogSavedViews = sanitizeCallLogSavedViews(
        (profile as { settings?: { callLogSavedViews?: unknown } }).settings?.callLogSavedViews
      )
    } catch {
      personalCallLogSavedViews = []
    }
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const { data: clinic, error: cErr } = await supabase
      .from('clinics')
      .select('id, name, vertical, settings')
      .eq('id', clinicId)
      .maybeSingle()

    if (cErr || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const vertical = normalizeVertical((clinic as { vertical?: string }).vertical)
    const clinicIdRow = (clinic as { id: string }).id
    let settingsObj: Record<string, unknown> =
      (clinic as { settings?: unknown }).settings &&
      typeof (clinic as { settings?: unknown }).settings === 'object'
        ? { ...((clinic as { settings: Record<string, unknown> }).settings) }
        : {}
    const beforeEnrich = { ...settingsObj }
    const enriched = await enrichClinicSettingsAgentConfig(settingsObj, vertical)
    if (clinicAgentConfigEnrichmentChanged(beforeEnrich, enriched)) {
      const { error: healErr } = await supabase
        .from('clinics')
        .update({ settings: enriched })
        .eq('id', clinicIdRow)
      if (!healErr) settingsObj = enriched
    }

    const { agentConfig, callAi: partialAi, callLogSavedViews } = parseClinicSettingsBlob(settingsObj)
    const callAi = mergeCallAiSettings(vertical, partialAi)

    return NextResponse.json({
      clinicId: clinicIdRow,
      clinicName: (clinic as { name: string }).name,
      vertical,
      userRole: role,
      settings: settingsObj ?? {},
      agentConfig: agentConfig ?? null,
      callAi,
      callLogSavedViews: callLogSavedViews ?? [],
      personalCallLogSavedViews,
    })
  } catch (e) {
    console.error('GET /api/super-admin/user-clinic-settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

    const targetUserId = new URL(request.url).searchParams.get('userId')?.trim()
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 })
    }

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('clinic_id, role, settings')
      .eq('id', targetUserId)
      .maybeSingle()

    if (pErr || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const clinicId = (profile as { clinic_id?: string | null }).clinic_id
    const role = (profile as { role?: string }).role
    let personalCallLogSavedViews: CallLogSavedView[] = []
    try {
      personalCallLogSavedViews = sanitizeCallLogSavedViews(
        (profile as { settings?: { callLogSavedViews?: unknown } }).settings?.callLogSavedViews
      )
    } catch {
      personalCallLogSavedViews = []
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'member' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const hasVertical =
      typeof body.vertical === 'string' &&
      ALLOWED_CLINIC_VERTICALS.includes(body.vertical as (typeof ALLOWED_CLINIC_VERTICALS)[number])
    const hasCallAi = body.callAi !== undefined && typeof body.callAi === 'object' && body.callAi
    const hasCallLogViews = Array.isArray(body.callLogSavedViews)
    const hasAgentClinicFacts =
      body.agentClinicFacts !== undefined &&
      typeof body.agentClinicFacts === 'object' &&
      body.agentClinicFacts !== null
    const hasAgentUiPatch =
      body.agentUiPatch !== undefined && typeof body.agentUiPatch === 'object' && body.agentUiPatch !== null
    if (role === 'member' && hasVertical) {
      return NextResponse.json(
        { error: 'Only administrators can change clinic type / vertical' },
        { status: 403 }
      )
    }
    if (role === 'member' && hasCallLogViews) {
      return NextResponse.json(
        {
          error:
            'Clinic-wide saved views can only be changed by administrators. Use Settings or PATCH /api/profile/preferences for personal views.',
        },
        { status: 403 }
      )
    }
    if (!hasVertical && !hasCallAi && !hasCallLogViews && !hasAgentClinicFacts && !hasAgentUiPatch) {
      return NextResponse.json(
        {
          error:
            'Provide vertical, callAi, callLogSavedViews, agentClinicFacts, and/or agentUiPatch to update',
        },
        { status: 400 }
      )
    }

    const { data: clinic, error: cErr } = await supabase
      .from('clinics')
      .select('vertical, settings')
      .eq('id', clinicId)
      .maybeSingle()

    if (cErr || !clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    let prevSettings: Record<string, unknown> =
      (clinic as { settings?: Record<string, unknown> }).settings &&
      typeof (clinic as { settings?: unknown }).settings === 'object'
        ? { ...((clinic as { settings: Record<string, unknown> }).settings) }
        : {}

    let nextVertical = normalizeVertical((clinic as { vertical?: string }).vertical)
    if (hasVertical) {
      nextVertical = body.vertical as typeof nextVertical
    }

    const existingPartial = (prevSettings.callAi as Partial<ClinicCallAiSettings>) || {}

    if (hasCallAi) {
      const incoming = body.callAi as Partial<ClinicCallAiSettings>
      const sanitized = sanitizeCallAiIncomingPatch(incoming)
      if (sanitized.callFlow && Object.keys(sanitized.callFlow).length > 0) {
        sanitized.callFlow = mergeVoiceCallFlow(existingPartial.callFlow, sanitized.callFlow)
      }
      const mergedPartial = { ...existingPartial, ...sanitized } as Partial<ClinicCallAiSettings>
      prevSettings.callAi = mergeCallAiSettings(nextVertical, mergedPartial)
    } else if (hasVertical) {
      prevSettings.callAi = mergeCallAiSettings(nextVertical, existingPartial)
    }

    if (hasCallLogViews) {
      prevSettings.callLogSavedViews = sanitizeCallLogSavedViews(body.callLogSavedViews)
    }

    if (hasAgentClinicFacts) {
      const { agentConfig: prevAc } = parseClinicSettingsBlob(prevSettings)
      prevSettings.agentConfig = applyAgentClinicFactsPatch(prevAc, body.agentClinicFacts)
    }

    if (hasAgentUiPatch) {
      const { agentConfig: prevAc } = parseClinicSettingsBlob(prevSettings)
      prevSettings.agentConfig = applyAgentUiPatch(prevAc, body.agentUiPatch)
    }

    const elApiKeyUa = process.env.ELEVENLABS_API_KEY?.trim()
    if (elApiKeyUa) {
      const { agentConfig: acForAssign } = parseClinicSettingsBlob(prevSettings)
      await ensureConvaiInboundLineAssignedToClinicAgent(elApiKeyUa, acForAssign ?? null)
    }
    prevSettings = await enrichClinicSettingsAgentConfig(prevSettings, nextVertical)

    const rowUpdate: { vertical?: string; settings: unknown } = { settings: prevSettings }
    if (hasVertical) {
      rowUpdate.vertical = body.vertical as string
    }

    const { data: saved, error: uErr } = await supabase
      .from('clinics')
      .update(rowUpdate)
      .eq('id', clinicId)
      .select('id, name, vertical, settings')
      .single()

    if (uErr) {
      console.error('PATCH super-admin user-clinic-settings', uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    const vertical = normalizeVertical((saved as { vertical?: string }).vertical)
    const { agentConfig, callAi: partialAi, callLogSavedViews } = parseClinicSettingsBlob(
      (saved as { settings?: unknown }).settings
    )
    const callAi = mergeCallAiSettings(vertical, partialAi)

    return NextResponse.json({
      clinicId: (saved as { id: string }).id,
      clinicName: (saved as { name: string }).name,
      vertical,
      userRole: role,
      agentConfig: agentConfig ?? null,
      callAi,
      callLogSavedViews: callLogSavedViews ?? [],
      personalCallLogSavedViews,
    })
  } catch (e) {
    console.error('PATCH /api/super-admin/user-clinic-settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
