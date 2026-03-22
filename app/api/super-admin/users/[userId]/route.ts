import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * DELETE /api/super-admin/users/[userId]
 * Permanently delete a user (auth + cascaded data). Super admin only; cannot delete yourself here.
 * Body: { "confirm": true }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetId } = await params
    if (!targetId?.trim()) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { confirm?: boolean } = {}
    try {
      body = (await request.json()) as { confirm?: boolean }
    } catch {
      /* empty */
    }
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Send { "confirm": true } to delete this user.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if ((profile as { role?: string } | null)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.id === targetId) {
      return NextResponse.json(
        { error: 'Use Settings → Account to delete your own account.' },
        { status: 400 }
      )
    }

    const { data: targetProfile } = await supabase.from('profiles').select('id').eq('id', targetId).maybeSingle()
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error: delError } = await supabase.auth.admin.deleteUser(targetId)
    if (delError) {
      console.error('super-admin deleteUser:', delError)
      return NextResponse.json({ error: delError.message || 'Could not delete user' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Super-admin user DELETE error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
