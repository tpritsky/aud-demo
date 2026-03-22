import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/invite/tokens'

/**
 * Public: load invite details for the accept-invite form (token proves access).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 400 })
    }

    const supabase = createServerClient()
    const token_hash = hashInviteToken(token)

    const { data: row, error } = await supabase
      .from('pending_invites')
      .select('email, full_name, role, expires_at, clinic_id')
      .eq('token_hash', token_hash)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }

    const expiresAt = new Date((row as { expires_at: string }).expires_at)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }

    const clinicId = (row as { clinic_id: string }).clinic_id
    const { data: clinic } = await supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle()
    const clinicName = (clinic as { name?: string } | null)?.name?.trim() || null

    return NextResponse.json({
      email: (row as { email: string }).email,
      fullName: (row as { full_name: string | null }).full_name,
      role: (row as { role: string }).role,
      clinicName,
    })
  } catch (e) {
    console.error('Invite preview error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
