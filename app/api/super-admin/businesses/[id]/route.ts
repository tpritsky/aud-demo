import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_CLINIC_VERTICALS, normalizeVertical, parseClinicSettingsBlob } from '@/lib/clinic-call-ai'
import { mergeClinicSettingsPayload } from '@/lib/merge-clinic-settings'
import { createServerClient } from '@/lib/supabase/server'
import { ensureConvaiInboundLineAssignedToClinicAgent } from '@/lib/server/elevenlabs-assign-phone'
import { enrichClinicSettingsAgentConfig } from '@/lib/server/elevenlabs-line-phone'

function requireSuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  return { token }
}

async function checkSuperAdmin(supabase: ReturnType<typeof createServerClient>, token: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return { error: 'Unauthorized' as const, status: 401 }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role?: string } | null)?.role !== 'super_admin') return { error: 'Forbidden' as const, status: 403 }
  return { user }
}

/**
 * GET /api/super-admin/businesses/[id]
 * Get one business with settings (including voice agent config). Super_admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clinicId } = await params
    if (!clinicId) return NextResponse.json({ error: 'Business ID required' }, { status: 400 })

    const { token } = requireSuperAdmin(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const auth = await checkSuperAdmin(supabase, token)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, vertical, created_at, settings')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: clinicError?.message || 'Business not found' }, { status: 404 })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('clinic_id', clinicId)

    const members = (profiles || []).map((p: { id: string; email: string; full_name: string | null; role: string }) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
    }))
    const settings = (clinic as { settings?: unknown }).settings ?? {}

    return NextResponse.json({
      business: {
        id: clinic.id,
        name: clinic.name,
        vertical: clinic.vertical,
        created_at: clinic.created_at,
        settings,
        admins: members.filter((m: { role: string }) => m.role === 'admin'),
        workers: members.filter((m: { role: string }) => m.role === 'member'),
      },
    })
  } catch (e) {
    console.error('Super-admin get business error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/super-admin/businesses/[id]
 * Update business (name, vertical, settings including voice agent config). Super_admin only.
 * Body: { name?: string, vertical?: string, settings?: { agentConfig?: AgentConfig } }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clinicId } = await params
    if (!clinicId) return NextResponse.json({ error: 'Business ID required' }, { status: 400 })

    const { token } = requireSuperAdmin(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const auth = await checkSuperAdmin(supabase, token)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const updates: { name?: string; vertical?: string; settings?: unknown } = {}

    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (
      typeof body.vertical === 'string' &&
      ALLOWED_CLINIC_VERTICALS.includes(body.vertical as (typeof ALLOWED_CLINIC_VERTICALS)[number])
    ) {
      updates.vertical = body.vertical
    }
    if (body.settings !== undefined && typeof body.settings === 'object') {
      const { data: existing } = await supabase
        .from('clinics')
        .select('settings, vertical')
        .eq('id', clinicId)
        .maybeSingle()
      const prev = (existing as { settings?: unknown } | null)?.settings
      let enrichVertical = normalizeVertical((existing as { vertical?: string } | null)?.vertical)
      if (
        typeof body.vertical === 'string' &&
        ALLOWED_CLINIC_VERTICALS.includes(body.vertical as (typeof ALLOWED_CLINIC_VERTICALS)[number])
      ) {
        enrichVertical = normalizeVertical(body.vertical)
      }
      let merged = mergeClinicSettingsPayload(prev, body.settings) as Record<string, unknown>
      const elKey = process.env.ELEVENLABS_API_KEY?.trim()
      if (elKey) {
        const { agentConfig } = parseClinicSettingsBlob(merged)
        await ensureConvaiInboundLineAssignedToClinicAgent(elKey, agentConfig ?? null)
      }
      merged = await enrichClinicSettingsAgentConfig(merged, enrichVertical)
      updates.settings = merged
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
    }

    const { data: clinic, error } = await supabase
      .from('clinics')
      .update(updates)
      .eq('id', clinicId)
      .select('id, name, vertical, settings')
      .single()

    if (error) {
      console.error('Super-admin PATCH business error:', error)
      return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ business: clinic })
  } catch (e) {
    console.error('Super-admin PATCH business error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * DELETE /api/super-admin/businesses/[id]
 * Delete a business (clinic). Super_admin only.
 * Profiles with this clinic_id will have clinic_id set to null (FK ON DELETE SET NULL).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clinicId } = await params
    if (!clinicId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 })
    }

    const { token } = requireSuperAdmin(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const auth = await checkSuperAdmin(supabase, token)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error: deleteError } = await supabase
      .from('clinics')
      .delete()
      .eq('id', clinicId)

    if (deleteError) {
      console.error('Delete business error:', deleteError)
      return NextResponse.json({ error: deleteError.message || 'Failed to delete business' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Delete business error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
