import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/super-admin/link-my-clinic
 * Sets clinic_id on the signed-in super_admin's profile (role stays super_admin).
 * Use this so platform admins can open Settings → Call & AI and clinic APIs without
 * demoting to admin. Body: { clinicId: string | null } — null clears the link.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const raw = body.clinicId
    if (raw !== null && typeof raw !== 'string') {
      return NextResponse.json({ error: 'clinicId must be a string or null' }, { status: 400 })
    }

    const clinicId = raw === null || raw === '' ? null : String(raw).trim()

    if (clinicId) {
      const { data: clinic, error: cErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', clinicId)
        .maybeSingle()
      if (cErr || !clinic) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ clinic_id: clinicId, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('link-my-clinic:', updateError)
      return NextResponse.json({ error: updateError.message || 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, clinicId })
  } catch (e) {
    console.error('link-my-clinic:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
