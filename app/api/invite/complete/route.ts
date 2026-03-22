import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/invite/tokens'

/**
 * Public: create auth user + profile after validating invite token (user did not exist before).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const full_name =
      typeof body.full_name === 'string' ? body.full_name.trim() || null : null

    if (!token) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = createServerClient()
    const token_hash = hashInviteToken(token)

    const { data: row, error: fetchErr } = await supabase
      .from('pending_invites')
      .select('id, email, clinic_id, role, expires_at')
      .eq('token_hash', token_hash)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }

    const invite = row as {
      id: string
      email: string
      clinic_id: string
      role: 'admin' | 'member'
      expires_at: string
    }

    const expiresAt = new Date(invite.expires_at)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }

    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', invite.email).maybeSingle()
    if (existingProfile) {
      await supabase.from('pending_invites').delete().eq('id', invite.id)
      return NextResponse.json(
        { error: 'An account with this email already exists. Sign in instead.' },
        { status: 409 }
      )
    }

    const displayName = full_name ?? ''
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { full_name: displayName } : {},
    })

    if (createError || !created?.user?.id) {
      if (
        createError?.message?.includes('already been registered') ||
        createError?.message?.includes('already exists')
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Sign in instead.' },
          { status: 409 }
        )
      }
      console.error('createUser:', createError)
      return NextResponse.json({ error: createError?.message || 'Could not create account' }, { status: 500 })
    }

    const userId = created.user.id

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name,
        clinic_id: invite.clinic_id,
        role: invite.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Profile update after invite:', profileError)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Could not finish account setup' }, { status: 500 })
    }

    await supabase.from('pending_invites').delete().eq('id', invite.id)

    return NextResponse.json({ ok: true, email: invite.email })
  } catch (e) {
    console.error('Invite complete error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
