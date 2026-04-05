import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertCallerIsSuperAdmin } from '@/lib/server/super-admin-auth'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

/**
 * GET /api/super-admin/user-scheduled-outbound/:id/events?userId=<target>
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const forbidden = await assertCallerIsSuperAdmin(supabase, user.id)
    if (forbidden) return forbidden

    const targetUserId = new URL(request.url).searchParams.get('userId')?.trim()
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', targetUserId)
      .maybeSingle()

    const clinicId = (profile as { clinic_id?: string | null })?.clinic_id
    const role = (profile as { role?: string })?.role
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'member' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: parent, error: pErr } = await supabase
      .from('scheduled_outbound_calls')
      .select('id, clinic_id, created_by')
      .eq('id', id)
      .maybeSingle()

    if (pErr || !parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = parent as { clinic_id: string; created_by: string }
    if (row.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (role === 'member' && row.created_by !== targetUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: events, error } = await supabase
      .from('scheduled_outbound_events')
      .select('id, event_type, detail, created_at')
      .eq('scheduled_outbound_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ events: [], note: 'Audit table not migrated yet' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: events || [] })
  } catch (e) {
    console.error('GET super-admin user-scheduled-outbound events', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
