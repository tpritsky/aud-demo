import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * DELETE /api/account
 * Permanently delete the authenticated user's auth user (cascades to profile and owned data).
 * Body: { "confirm": true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { confirm?: boolean } = {}
    try {
      body = (await request.json()) as { confirm?: boolean }
    } catch {
      /* empty body */
    }
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Send { "confirm": true } to delete your account.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
    if (delError) {
      console.error('deleteUser:', delError)
      return NextResponse.json({ error: delError.message || 'Could not delete account' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Account DELETE error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
