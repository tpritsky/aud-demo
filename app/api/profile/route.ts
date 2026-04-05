import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { clinicOnboardingIncomplete } from '@/lib/clinic-call-ai'

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
      .select('role, clinic_id, email, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ role: null, clinicId: null, email: null, fullName: null })
    }

    const r = profile as {
      role: string
      clinic_id: string | null
      email: string
      full_name: string | null
    }
    const role = r.role === 'super_admin' || r.role === 'admin' || r.role === 'member'
      ? (r.role as 'super_admin' | 'admin' | 'member')
      : null
    if (!role) {
      return NextResponse.json({ role: null, clinicId: null, email: r.email ?? null, fullName: r.full_name ?? null })
    }

    let needsClinicOnboarding = false
    if (role !== 'super_admin' && r.clinic_id) {
      const { data: clinicRow } = await supabase
        .from('clinics')
        .select('settings')
        .eq('id', r.clinic_id)
        .maybeSingle()
      needsClinicOnboarding = clinicOnboardingIncomplete(
        (clinicRow as { settings?: unknown } | null)?.settings
      )
    }

    return NextResponse.json({
      role,
      clinicId: r.clinic_id ?? null,
      email: r.email ?? user.email ?? null,
      fullName: r.full_name ?? null,
      needsClinicOnboarding,
    })
  } catch (e) {
    console.error('Profile API error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
