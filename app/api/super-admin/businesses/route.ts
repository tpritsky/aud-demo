import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface BusinessWithWorkers {
  id: string
  name: string
  vertical: string
  created_at: string
  workers: {
    id: string
    email: string
    full_name: string | null
    role: string
  }[]
}

/**
 * GET /api/super-admin/businesses
 * Returns all clinics (businesses) and their workers. Super_admin only.
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

    const role = (profile as { role?: string } | null)?.role
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, vertical, created_at')
      .order('name')

    if (clinicsError) {
      console.error('Super-admin businesses clinics error:', clinicsError)
      return NextResponse.json({ error: 'Failed to load businesses' }, { status: 500 })
    }

    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, clinic_id')
      .not('clinic_id', 'is', null)

    if (profilesError) {
      console.error('Super-admin businesses profiles error:', profilesError)
      return NextResponse.json({ error: 'Failed to load workers' }, { status: 500 })
    }

    const byClinic = (allProfiles || []).reduce(
      (acc, p) => {
        const cid = (p as { clinic_id: string }).clinic_id
        if (!acc[cid]) acc[cid] = []
        acc[cid].push({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: p.role,
        })
        return acc
      },
      {} as Record<string, { id: string; email: string; full_name: string | null; role: string }[]>
    )

    const businesses: BusinessWithWorkers[] = (clinics || []).map((c) => ({
      id: c.id,
      name: c.name,
      vertical: c.vertical,
      created_at: c.created_at,
      workers: byClinic[c.id] || [],
    }))

    return NextResponse.json({ businesses })
  } catch (e) {
    console.error('Super-admin businesses error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
