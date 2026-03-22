import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/team/add-worker
 * Add an existing user to the current user's clinic as a worker (member).
 * Exact email match only - no suggestions, no reveal of whether user exists.
 * Admin of a clinic only.
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
      .select('role, clinic_id')
      .eq('id', user.id)
      .single()

    const p = profile as { role?: string; clinic_id?: string | null } | null
    if (!p || p.role !== 'admin' || !p.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Exact match only - do not reveal whether user exists
    const { data: targetProfile, error: findError } = await supabase
      .from('profiles')
      .select('id, clinic_id, role')
      .eq('email', email)
      .maybeSingle()

    if (findError || !targetProfile) {
      return NextResponse.json({ error: 'Could not add user. Check the email is correct and try again.' }, { status: 400 })
    }

    const target = targetProfile as { id: string; clinic_id: string | null; role: string }
    if (target.clinic_id === p.clinic_id) {
      return NextResponse.json({ error: 'Could not add user. Check the email is correct and try again.' }, { status: 400 })
    }

    // Super admins are not assigned to a clinic; do not overwrite
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Could not add user. Check the email is correct and try again.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ clinic_id: p.clinic_id, role: 'member', updated_at: new Date().toISOString() })
      .eq('id', target.id)

    if (updateError) {
      console.error('Add worker error:', updateError)
      return NextResponse.json({ error: 'Could not add user. Check the email is correct and try again.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId: target.id })
  } catch (e) {
    console.error('Add worker error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
