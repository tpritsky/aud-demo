import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertCallerIsSuperAdmin } from '@/lib/server/super-admin-auth'
import { runClinicElevenLabsPromptSync } from '@/lib/server/run-clinic-elevenlabs-prompt-sync'

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

    if (!process.env.ELEVENLABS_API_KEY?.trim()) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    const sync = await runClinicElevenLabsPromptSync({ supabase, clinicId })
    if (!sync.ran) {
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
    console.error('POST /api/super-admin/clinic-sync-elevenlabs', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
