import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/super-admin/assign-role
 * Assign a user to a business as admin or worker. Super_admin only.
 * Body: { userId: string, clinicId: string, role: 'admin' | 'member' }
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
    const clinicId = typeof body.clinicId === 'string' ? body.clinicId.trim() : ''
    const role = body.role === 'admin' || body.role === 'member' ? body.role : null

    if (!userId || !clinicId || !role) {
      return NextResponse.json({ error: 'userId, clinicId, and role (admin|member) are required' }, { status: 400 })
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if ((target as { role?: string } | null)?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot assign a super admin to a business' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        clinic_id: clinicId,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Assign role error:', updateError)
      return NextResponse.json({ error: updateError.message || 'Failed to assign' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Assign role error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
