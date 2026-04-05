import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sanitizeCallLogSavedViews } from '@/lib/clinic-call-ai'
import type { CallLogSavedView } from '@/lib/types'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

function parsePersonalViews(raw: unknown): CallLogSavedView[] {
  if (!raw || typeof raw !== 'object') return []
  const s = (raw as { callLogSavedViews?: unknown }).callLogSavedViews
  if (!Array.isArray(s)) return []
  return sanitizeCallLogSavedViews(s)
}

/**
 * GET /api/profile/preferences — personal call-log views (profiles.settings).
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: row, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      if (error.message?.includes('settings') || error.code === '42703') {
        return NextResponse.json({ callLogSavedViews: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const views = parsePersonalViews((row as { settings?: unknown } | null)?.settings)
    return NextResponse.json({ callLogSavedViews: views })
  } catch (e) {
    console.error('GET /api/profile/preferences', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/profile/preferences — body: { callLogSavedViews: CallLogSavedView[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!Array.isArray(body.callLogSavedViews)) {
      return NextResponse.json({ error: 'callLogSavedViews array required' }, { status: 400 })
    }

    const sanitized = sanitizeCallLogSavedViews(body.callLogSavedViews)

    const { data: existing } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle()

    const prev =
      existing && typeof (existing as { settings?: unknown }).settings === 'object'
        ? { ...((existing as { settings: Record<string, unknown> }).settings) }
        : {}

    const nextSettings = { ...prev, callLogSavedViews: sanitized }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ settings: nextSettings })
      .eq('id', user.id)

    if (upErr) {
      if (upErr.message?.includes('settings') || upErr.code === '42703') {
        return NextResponse.json(
          {
            error:
              'profiles.settings column missing — run migration 016_profiles_settings_jsonb.sql in Supabase',
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ callLogSavedViews: sanitized })
  } catch (e) {
    console.error('PATCH /api/profile/preferences', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
