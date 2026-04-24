import { after, NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  ALLOWED_CLINIC_VERTICALS,
  applyAgentClinicFactsPatch,
  applyAgentUiPatch,
  clinicOnboardingIncomplete,
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
  sanitizeCallAiIncomingPatch,
  sanitizeCallLogSavedViews,
} from '@/lib/clinic-call-ai'
import type { CallLogSavedView, ClinicCallAiSettings } from '@/lib/types'
import { mergeVoiceCallFlow } from '@/lib/voice-call-flow'
import { provisionElevenLabsOnOnboardingComplete } from '@/lib/server/elevenlabs-create-agent'
import { ensureConvaiInboundLineAssignedToClinicAgent } from '@/lib/server/elevenlabs-assign-phone'
import {
  clinicAgentConfigEnrichmentChanged,
  enrichClinicSettingsAgentConfig,
} from '@/lib/server/elevenlabs-line-phone'
import { runClinicElevenLabsPromptSync } from '@/lib/server/run-clinic-elevenlabs-prompt-sync'

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get('Authorization')
  return h?.replace(/^Bearer\s+/i, '') || null
}

/**
 * GET /api/clinic/settings
 * Clinic vertical + merged settings (agentConfig + callAi) for the signed-in user's clinic.
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('clinic_id, role, settings')
      .eq('id', user.id)
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
      onboardingCompleted: !clinicOnboardingIncomplete(settingsObj),
    })
  } catch (e) {
    console.error('GET /api/clinic/settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/clinic/settings
 * Body: { vertical?, callAi?, callLogSavedViews?, agentClinicFacts? }
 * Members may edit call AI; only admins may change vertical or **clinic-wide** saved views.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('clinic_id, role, settings')
      .eq('id', user.id)
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
    const hasCompleteOnboarding = body.completeClinicOnboarding === true
    const hasClinicNameField = typeof body.clinicName === 'string' && body.clinicName.trim().length > 0
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
    if (role === 'member' && hasClinicNameField) {
      return NextResponse.json(
        { error: 'Only administrators can change the business name on the account.' },
        { status: 403 }
      )
    }
    if (role === 'member' && hasAgentUiPatch) {
      return NextResponse.json(
        { error: 'Only administrators can change the receptionist line.' },
        { status: 403 }
      )
    }
    if (
      !hasVertical &&
      !hasCallAi &&
      !hasCallLogViews &&
      !hasAgentClinicFacts &&
      !hasAgentUiPatch &&
      !hasCompleteOnboarding &&
      !hasClinicNameField
    ) {
      return NextResponse.json(
        {
          error:
            'Provide vertical, callAi, callLogSavedViews, agentClinicFacts, agentUiPatch, clinicName, and/or completeClinicOnboarding',
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

    let agentClinicFactsForPatch: unknown = hasAgentClinicFacts ? body.agentClinicFacts : null
    if (role === 'member' && agentClinicFactsForPatch && typeof agentClinicFactsForPatch === 'object') {
      const { agentConfig: prevAc } = parseClinicSettingsBlob(prevSettings)
      const pn = typeof prevAc?.phoneNumber === 'string' ? prevAc.phoneNumber.trim() : ''
      const lid =
        typeof prevAc?.elevenLabsPhoneNumberId === 'string' ? prevAc.elevenLabsPhoneNumberId.trim() : ''
      const phoneAlreadySet = Boolean(pn) || Boolean(lid)
      if (phoneAlreadySet) {
        const o = { ...(agentClinicFactsForPatch as Record<string, unknown>) }
        delete o.phoneNumber
        agentClinicFactsForPatch = o
      }
    }

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
      prevSettings.agentConfig = applyAgentClinicFactsPatch(prevAc, agentClinicFactsForPatch)
    }

    if (hasAgentUiPatch) {
      const { agentConfig: prevAc } = parseClinicSettingsBlob(prevSettings)
      prevSettings.agentConfig = applyAgentUiPatch(prevAc, body.agentUiPatch)
    }

    if (hasCompleteOnboarding) {
      const prevOb =
        prevSettings.onboarding && typeof prevSettings.onboarding === 'object'
          ? { ...(prevSettings.onboarding as Record<string, unknown>) }
          : {}
      prevSettings.onboarding = {
        ...prevOb,
        completed: true,
        completedAt: new Date().toISOString(),
      }
    }

    let elevenLabsProvisioning: {
      ok: boolean
      created?: boolean
      error?: string
      skippedReason?: 'no_api_key'
    } | null = null
    if (hasCompleteOnboarding) {
      const el = await provisionElevenLabsOnOnboardingComplete({
        prevSettings,
        vertical: nextVertical,
        hasCompleteOnboarding: true,
      })
      if (el.attempted) {
        if ('skippedReason' in el && el.skippedReason === 'no_api_key') {
          elevenLabsProvisioning = { ok: false, skippedReason: 'no_api_key' }
        } else if (el.ok) {
          elevenLabsProvisioning = { ok: true, created: el.created }
        } else {
          elevenLabsProvisioning = {
            ok: false,
            error: 'error' in el && typeof el.error === 'string' ? el.error : 'ElevenLabs provisioning failed',
            ...(typeof el.created === 'boolean' ? { created: el.created } : {}),
          }
        }
      }
    }

    const elApiKey = process.env.ELEVENLABS_API_KEY?.trim()
    if (elApiKey) {
      const { agentConfig: acForAssign } = parseClinicSettingsBlob(prevSettings)
      await ensureConvaiInboundLineAssignedToClinicAgent(elApiKey, acForAssign ?? null)
    }
    prevSettings = await enrichClinicSettingsAgentConfig(prevSettings, nextVertical)

    const nextClinicName =
      hasClinicNameField && (role === 'admin' || role === 'super_admin')
        ? (body.clinicName as string).trim().slice(0, 200)
        : null

    const rowUpdate: { vertical?: string; settings: unknown; name?: string } = { settings: prevSettings }
    if (hasVertical) {
      rowUpdate.vertical = body.vertical as string
    }
    if (nextClinicName) {
      rowUpdate.name = nextClinicName
    }

    const { data: saved, error: uErr } = await supabase
      .from('clinics')
      .update(rowUpdate)
      .eq('id', clinicId)
      .select('id, name, vertical, settings')
      .single()

    if (uErr) {
      console.error('PATCH clinic settings', uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    const vertical = normalizeVertical((saved as { vertical?: string }).vertical)
    const { agentConfig, callAi: partialAi, callLogSavedViews } = parseClinicSettingsBlob(
      (saved as { settings?: unknown }).settings
    )
    const callAi = mergeCallAiSettings(vertical, partialAi)

    const savedSettings = (saved as { settings?: unknown }).settings

    if (
      elApiKey &&
      (hasCallAi || hasAgentClinicFacts || hasAgentUiPatch || hasCompleteOnboarding || hasVertical)
    ) {
      const cid = clinicId
      const sb = supabase
      after(() =>
        runClinicElevenLabsPromptSync({ supabase: sb, clinicId: cid })
          .then((r) => {
            if (!r.ran) return
            const failed = r.results.filter((x) => !x.ok)
            if (failed.length) {
              console.warn('[clinic settings] ElevenLabs auto-sync failures', failed)
            }
          })
          .catch((e) => console.error('[clinic settings] ElevenLabs auto-sync', e))
      )
    }

    return NextResponse.json({
      clinicId: (saved as { id: string }).id,
      clinicName: (saved as { name: string }).name,
      vertical,
      userRole: role,
      agentConfig: agentConfig ?? null,
      callAi,
      callLogSavedViews: callLogSavedViews ?? [],
      personalCallLogSavedViews,
      onboardingCompleted: !clinicOnboardingIncomplete(savedSettings),
      ...(elevenLabsProvisioning ? { elevenLabsProvisioning } : {}),
    })
  } catch (e) {
    console.error('PATCH /api/clinic/settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
