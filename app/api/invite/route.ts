import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

    if (!profile || profile.role !== 'admin' || !profile.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() || null : null
    const role = body.role === 'admin' ? 'admin' : 'member'

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/reset-password`,
    })

    if (inviteError) {
      if (inviteError.message?.includes('already been registered') || inviteError.message?.includes('already exists')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }
      console.error('Invite error:', inviteError)
      return NextResponse.json({ error: inviteError.message || 'Invite failed' }, { status: 500 })
    }

    const invitedUserId = inviteData.user?.id
    if (invitedUserId) {
      await supabase.from('profiles').upsert(
        {
          id: invitedUserId,
          email,
          full_name,
          clinic_id: profile.clinic_id,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    }

    return NextResponse.json({
      ok: true,
      userId: invitedUserId,
      email,
      full_name,
      role,
    })
  } catch (e) {
    console.error('Invite API error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
