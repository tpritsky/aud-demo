import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertCallerIsSuperAdmin } from '@/lib/server/super-admin-auth'
import {
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
} from '@/lib/clinic-call-ai'
import { getElevenLabsSyncTargets } from '@/lib/elevenlabs-placeholders'
import { syncElevenLabsAgentPrompt } from '@/lib/server/elevenlabs-prompt-sync'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

/**
 * POST /api/super-admin/clinic-sync-elevenlabs
 * Body: { clinicId: string } — push prompts for that clinic (super_admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

    const body = await request.json()
    const clinicId = typeof body.clinicId === 'string' ? body.clinicId.trim() : ''
    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    const { data: clinic, error: cErr } = await supabase
      .from('clinics')
      .select('vertical, settings')
      .eq('id', clinicId)
      .maybeSingle()

    if (cErr || !clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    const vertical = normalizeVertical((clinic as { vertical?: string }).vertical)
    const { agentConfig, callAi: partialAi } = parseClinicSettingsBlob((clinic as { settings?: unknown }).settings)
    const callAi = mergeCallAiSettings(vertical, partialAi)

    const { targets, skippedDemoIds } = getElevenLabsSyncTargets(agentConfig ?? null)

    if (targets.length === 0) {
      return NextResponse.json(
        {
          error:
            skippedDemoIds.length > 0
              ? 'This clinic still has demo ElevenLabs agent IDs. Finish onboarding so real agents are created, or paste your ConvAI agent IDs under Agent settings, then push again.'
              : 'No ElevenLabs agent IDs in clinic settings (set inbound and/or outbound agent ID)',
          results: skippedDemoIds.map((agentId) => ({
            agentId,
            ok: false,
            error:
              'Demo/template agent ID from the app defaults — not an agent in your workspace. Replace it with your provisioned agent.',
          })),
        },
        { status: 400 }
      )
    }

    const results: { agentId: string; ok: boolean; error?: string }[] = []
    for (const agentId of targets) {
      const r = await syncElevenLabsAgentPrompt({
        agentId,
        apiKey,
        vertical,
        callAi,
        speechSpeed: agentConfig?.speechSpeed,
      })
      results.push(r.ok ? { agentId, ok: true } : { agentId, ok: false, error: r.error })
    }

    const failed = results.filter((r) => !r.ok)
    if (failed.length === results.length) {
      return NextResponse.json({ error: 'All agent syncs failed', results }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      message:
        failed.length > 0
          ? 'Some agents synced; check results for errors'
          : 'ElevenLabs prompts updated',
      results,
    })
  } catch (e) {
    console.error('POST /api/super-admin/clinic-sync-elevenlabs', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
