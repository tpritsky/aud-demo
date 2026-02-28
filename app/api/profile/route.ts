import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/profile
 * Returns the current user's profile (role, clinicId) using service role so RLS doesn't block it.
 * Authorization: Bearer <access_token>
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, clinic_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ role: null, clinicId: null })
    }

    const r = profile as { role: string; clinic_id: string | null }
    if (r.role !== 'admin' && r.role !== 'member') {
      return NextResponse.json({ role: null, clinicId: null })
    }

    return NextResponse.json({
      role: r.role as 'admin' | 'member',
      clinicId: r.clinic_id ?? null,
    })
  } catch (e) {
    console.error('Profile API error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
