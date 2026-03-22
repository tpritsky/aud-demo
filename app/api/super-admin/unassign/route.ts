import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/super-admin/unassign
 * Remove a user from their current business (set clinic_id to null). Super_admin only.
 * Body: { userId: string }
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
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if ((target as { role?: string } | null)?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot unassign a super admin' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        clinic_id: null,
        role: 'member',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Unassign error:', updateError)
      return NextResponse.json({ error: updateError.message || 'Failed to unassign' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Unassign error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
