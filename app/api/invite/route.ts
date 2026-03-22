import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { newInviteToken } from '@/lib/invite/tokens'
import { sendClinicInviteEmail } from '@/lib/email/send-clinic-invite'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role, clinic_id').eq('id', user.id).single()

    const profileRole = (profile as { role?: string; clinic_id?: string | null } | null)?.role
    const isSuperAdmin = profileRole === 'super_admin'
    const isAdmin = profileRole === 'admin'

    if (!profile || (!isSuperAdmin && !isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() || null : null
    const role = body.role === 'admin' ? 'admin' : 'member'
    const bodyClinicId = typeof body.clinic_id === 'string' ? body.clinic_id.trim() : ''

    let targetClinicId: string | null = null
    if (isSuperAdmin) {
      if (!bodyClinicId) {
        return NextResponse.json({ error: 'clinic_id is required for platform invites' }, { status: 400 })
      }
      const { data: clinicRow, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', bodyClinicId)
        .maybeSingle()
      if (clinicErr || !clinicRow) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }
      targetClinicId = bodyClinicId
    } else {
      const adminClinicId = (profile as { clinic_id?: string | null }).clinic_id ?? null
      if (!adminClinicId) {
        return NextResponse.json({ error: 'Your account is not linked to a clinic' }, { status: 403 })
      }
      targetClinicId = adminClinicId
    }

    const { data: clinicForEmail } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', targetClinicId)
      .maybeSingle()
    const clinic_name =
      (clinicForEmail as { name?: string } | null)?.name?.trim() || 'your organization'

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
    if (existingProfile) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    await supabase.from('pending_invites').delete().eq('email', email).eq('clinic_id', targetClinicId)

    const { raw: rawToken, hash: token_hash } = newInviteToken()
    const expires_at = new Date(Date.now() + INVITE_TTL_MS).toISOString()

    const { data: inserted, error: insertError } = await supabase
      .from('pending_invites')
      .insert({
        email,
        full_name,
        clinic_id: targetClinicId,
        role,
        token_hash,
        expires_at,
        invited_by: user.id,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('pending_invites insert:', insertError)
      return NextResponse.json({ error: insertError?.message || 'Could not create invite' }, { status: 500 })
    }

    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '')
    const inviteUrl = `${appOrigin}/accept-invite?token=${encodeURIComponent(rawToken)}`
    const role_label = role === 'admin' ? 'Administrator' : 'Team member'

    let emailSent = false
    try {
      emailSent = await sendClinicInviteEmail({
        to: email,
        inviteUrl,
        clinicName: clinic_name,
        roleLabel: role_label,
        inviteeName: full_name,
      })
    } catch (e) {
      await supabase.from('pending_invites').delete().eq('id', inserted.id)
      const msg = e instanceof Error ? e.message : 'Email send failed'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    if (!emailSent) {
      if (process.env.NODE_ENV === 'production') {
        await supabase.from('pending_invites').delete().eq('id', inserted.id)
        return NextResponse.json(
          {
            error:
              'Invite email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL (verified domain) in production.',
          },
          { status: 503 }
        )
      }
      console.warn('[invite] RESEND_API_KEY missing — dev invite link:', inviteUrl)
      return NextResponse.json({
        ok: true,
        emailSent: false,
        inviteUrl,
        email,
        full_name,
        role,
      })
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      email,
      full_name,
      role,
    })
  } catch (e) {
    console.error('Invite API error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
