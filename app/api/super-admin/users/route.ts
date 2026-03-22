import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/super-admin/users
 * Returns all users (profiles) for super_admin to assign as admins. Super_admin only.
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
    const search = searchParams.get('search')?.trim()?.toLowerCase() || ''

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, clinic_id')
      .order('email')

    if (search.length >= 1) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error('Super-admin users error:', error)
      return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
    }

    return NextResponse.json({ users: profiles || [] })
  } catch (e) {
    console.error('Super-admin users error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
