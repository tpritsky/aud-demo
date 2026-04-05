import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertCallerIsSuperAdmin } from '@/lib/server/super-admin-auth'
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

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get('Authorization')
  return h?.replace(/^Bearer\s+/i, '') || null
}

function clinicIdFromUrl(request: NextRequest): string | null {
  return new URL(request.url).searchParams.get('clinicId')?.trim() || null
}

/**
 * GET /api/super-admin/clinic-settings?clinicId=<uuid>
 * Same response shape as /api/clinic/settings. Super admin only; for editing a business without view-as.
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = clinicIdFromUrl(request)
    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId query parameter is required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

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
      userRole: 'super_admin' as const,
      settings: settingsObj ?? {},
      agentConfig: agentConfig ?? null,
      callAi,
      callLogSavedViews: callLogSavedViews ?? [],
      personalCallLogSavedViews: [] as CallLogSavedView[],
      onboardingCompleted: !clinicOnboardingIncomplete(settingsObj),
    })
  } catch (e) {
    console.error('GET /api/super-admin/clinic-settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/super-admin/clinic-settings?clinicId=<uuid>
 * Body: { vertical?, callAi?, callLogSavedViews?, agentClinicFacts? } — same as /api/clinic/settings.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = clinicIdFromUrl(request)
    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId query parameter is required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

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

    const elApiKeySa = process.env.ELEVENLABS_API_KEY?.trim()
    if (elApiKeySa) {
      const { agentConfig: acForAssign } = parseClinicSettingsBlob(prevSettings)
      await ensureConvaiInboundLineAssignedToClinicAgent(elApiKeySa, acForAssign ?? null)
    }
    prevSettings = await enrichClinicSettingsAgentConfig(prevSettings, nextVertical)

    const nextClinicName = hasClinicNameField ? (body.clinicName as string).trim().slice(0, 200) : null

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
      console.error('PATCH super-admin clinic-settings', uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    const vertical = normalizeVertical((saved as { vertical?: string }).vertical)
    const { agentConfig, callAi: partialAi, callLogSavedViews } = parseClinicSettingsBlob(
      (saved as { settings?: unknown }).settings
    )
    const callAi = mergeCallAiSettings(vertical, partialAi)

    const savedSettings = (saved as { settings?: unknown }).settings
    return NextResponse.json({
      clinicId: (saved as { id: string }).id,
      clinicName: (saved as { name: string }).name,
      vertical,
      userRole: 'super_admin' as const,
      agentConfig: agentConfig ?? null,
      callAi,
      callLogSavedViews: callLogSavedViews ?? [],
      personalCallLogSavedViews: [] as CallLogSavedView[],
      onboardingCompleted: !clinicOnboardingIncomplete(savedSettings),
      ...(elevenLabsProvisioning ? { elevenLabsProvisioning } : {}),
    })
  } catch (e) {
    console.error('PATCH /api/super-admin/clinic-settings', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
