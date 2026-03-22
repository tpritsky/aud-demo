import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/super-admin/user-profile?userId=xxx
 * Returns a user's profile and clinic for "view as" feature. Super_admin only.
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if ((profile as { role?: string } | null)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')?.trim()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, clinic_id')
      .eq('id', userId)
      .single()

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const p = targetProfile as { id: string; email: string; full_name: string | null; role: string; clinic_id: string | null }
    let clinic: { id: string; name: string; vertical: string } | null = null
    if (p.clinic_id) {
      const { data: c } = await supabase
        .from('clinics')
        .select('id, name, vertical')
        .eq('id', p.clinic_id)
        .single()
      clinic = c as { id: string; name: string; vertical: string } | null
    }

    return NextResponse.json({
      user: { id: p.id, email: p.email, full_name: p.full_name, role: p.role },
      clinicId: p.clinic_id,
      clinic,
    })
  } catch (e) {
    console.error('Super-admin user-profile error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
