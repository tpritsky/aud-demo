import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
} from '@/lib/clinic-call-ai'
import { runClinicElevenLabsPromptSync } from '@/lib/server/run-clinic-elevenlabs-prompt-sync'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

/**
 * POST /api/clinic/sync-elevenlabs
 * Admin only: push inbound + outbound playbook text into ElevenLabs agent system prompts
 * (managed block delimiters; merges with existing prompt).
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const clinicId = (profile as { clinic_id?: string | null })?.clinic_id
    const role = (profile as { role?: string })?.role
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Only clinic administrators can sync ElevenLabs prompts' }, { status: 403 })
    }

    if (!process.env.ELEVENLABS_API_KEY?.trim()) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    const sync = await runClinicElevenLabsPromptSync({ supabase, clinicId })
    if (!sync.ran) {
      if (sync.skipReason === 'no_api_key') {
        return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
      }
      if (sync.skipReason === 'clinic_not_found') {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
      }
      if (sync.skipReason === 'demo_or_missing_agent_ids') {
        return NextResponse.json(
          {
            error:
              'This clinic still has demo ElevenLabs agent IDs. Finish onboarding so real agents are created, or paste your ConvAI agent IDs under Agent settings, then push again.',
            results: sync.skippedDemoIds.map((agentId) => ({
              agentId,
              ok: false,
              error:
                'Demo/template agent ID from the app defaults — not an agent in your workspace. Replace it with your provisioned agent.',
            })),
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'No ElevenLabs agent IDs in clinic settings (set inbound and/or outbound agent ID)' },
        { status: 400 }
      )
    }

    const { results } = sync
    const failed = results.filter((r) => !r.ok)
    if (failed.length === results.length) {
      return NextResponse.json({ error: 'All agent syncs failed', results }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      message: failed.length > 0 ? 'Some agents synced; check results for errors' : 'ElevenLabs prompts updated',
      results,
    })
  } catch (e) {
    console.error('POST /api/clinic/sync-elevenlabs', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
