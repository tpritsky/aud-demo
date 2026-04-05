import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ALLOWED_CLINIC_VERTICALS } from '@/lib/clinic-call-ai'

export interface BusinessMember {
  id: string
  email: string
  full_name: string | null
  role: string
}

export interface BusinessWithWorkers {
  id: string
  name: string
  vertical: string
  created_at: string
  admins: BusinessMember[]
  workers: BusinessMember[]
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
      {} as Record<string, BusinessMember[]>
    )

    const businesses: BusinessWithWorkers[] = (clinics || []).map((c) => {
      const members = byClinic[c.id] || []
      return {
        id: c.id,
        name: c.name,
        vertical: c.vertical,
        created_at: c.created_at,
        admins: members.filter((m) => m.role === 'admin'),
        workers: members.filter((m) => m.role === 'member'),
      }
    })

    return NextResponse.json({ businesses })
  } catch (e) {
    console.error('Super-admin businesses error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * POST /api/super-admin/businesses
 * Create a new business (clinic). Super_admin only.
 * Body: { name: string, vertical?: string }
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
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const vertical =
      typeof body.vertical === 'string' && ALLOWED_CLINIC_VERTICALS.includes(body.vertical as (typeof ALLOWED_CLINIC_VERTICALS)[number])
        ? body.vertical
        : 'general'

    if (!name) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const { data: clinic, error: insertError } = await supabase
      .from('clinics')
      .insert({
        name,
        vertical,
        settings: { onboarding: { completed: false, version: 1 } },
      })
      .select('id, name, vertical, created_at')
      .single()

    if (insertError) {
      console.error('Super-admin create business error:', insertError)
      return NextResponse.json({ error: insertError.message || 'Failed to create business' }, { status: 500 })
    }

    return NextResponse.json({
      business: {
        id: clinic.id,
        name: clinic.name,
        vertical: clinic.vertical,
        created_at: clinic.created_at,
        admins: [],
        workers: [],
      },
    })
  } catch (e) {
    console.error('Super-admin create business error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
