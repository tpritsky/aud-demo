import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/phone-format'
import type { ScheduledOutboundCall } from '@/lib/types'
import { enqueueScheduledOutboundDispatch } from '@/lib/server/enqueue-scheduled-outbound-qstash'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

function rowToApp(r: Record<string, unknown>): ScheduledOutboundCall {
  return {
    id: r.id as string,
    clinicId: r.clinic_id as string,
    createdBy: r.created_by as string,
    toNumber: r.to_number as string,
    scheduledFor: new Date(r.scheduled_for as string),
    status: r.status as ScheduledOutboundCall['status'],
    callGoal: r.call_goal as string,
    callReason: (r.call_reason as string) || undefined,
    patientId: (r.patient_id as string) || undefined,
    extraContext: (r.extra_context as string) || undefined,
    conversationId: (r.conversation_id as string) || undefined,
    errorMessage: (r.error_message as string) || undefined,
    createdAt: new Date(r.created_at as string),
    attemptCount: typeof r.attempt_count === 'number' ? r.attempt_count : undefined,
    maxAttempts: typeof r.max_attempts === 'number' ? r.max_attempts : undefined,
    lastAttemptAt: r.last_attempt_at ? new Date(r.last_attempt_at as string) : null,
    nextRetryAt: r.next_retry_at ? new Date(r.next_retry_at as string) : null,
  }
}

/**
 * GET /api/clinic/scheduled-outbound — upcoming + recent scheduled calls for the user's clinic.
 */
export async function GET(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const clinicId = (profile as { clinic_id?: string | null })?.clinic_id
    const role = (profile as { role?: string })?.role
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'member' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from('scheduled_outbound_calls')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('scheduled_for', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ calls: (rows || []).map((r) => rowToApp(r as Record<string, unknown>)) })
  } catch (e) {
    console.error('GET scheduled-outbound', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * POST /api/clinic/scheduled-outbound
 * Body: { to_number, scheduled_for (ISO), call_goal, call_reason?, patient_id?, extra_context? }
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const clinicId = (profile as { clinic_id?: string | null })?.clinic_id
    const role = (profile as { role?: string })?.role
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'member' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const toRaw = typeof body.to_number === 'string' ? body.to_number : ''
    const callGoal = typeof body.call_goal === 'string' ? body.call_goal.trim() : ''
    const scheduledForRaw = typeof body.scheduled_for === 'string' ? body.scheduled_for : ''
    if (!toRaw || !callGoal || !scheduledForRaw) {
      return NextResponse.json({ error: 'to_number, call_goal, and scheduled_for are required' }, { status: 400 })
    }

    const normalized = normalizePhoneNumber(toRaw)
    if (!normalized.startsWith('+') || normalized.length < 11) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const scheduledFor = new Date(scheduledForRaw)
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'scheduled_for must be a valid future time' }, { status: 400 })
    }

    let maxAttempts = 3
    if (body.max_attempts !== undefined) {
      const n = Number(body.max_attempts)
      if (!Number.isNaN(n)) maxAttempts = Math.min(10, Math.max(1, Math.round(n)))
    }

    const insert = {
      clinic_id: clinicId,
      created_by: user.id,
      to_number: normalized,
      scheduled_for: scheduledFor.toISOString(),
      call_goal: callGoal.slice(0, 2000),
      call_reason: typeof body.call_reason === 'string' ? body.call_reason.slice(0, 2000) : null,
      patient_id: typeof body.patient_id === 'string' ? body.patient_id : null,
      extra_context: typeof body.extra_context === 'string' ? body.extra_context.slice(0, 8000) : null,
      status: 'scheduled' as const,
      max_attempts: maxAttempts,
    }

    const { data: row, error } = await supabase.from('scheduled_outbound_calls').insert(insert).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const appRow = rowToApp(row as Record<string, unknown>)
    void enqueueScheduledOutboundDispatch(appRow.id, appRow.scheduledFor)

    return NextResponse.json({ call: appRow })
  } catch (e) {
    console.error('POST scheduled-outbound', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/clinic/scheduled-outbound — cancel { id }
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const clinicId = (profile as { clinic_id?: string | null })?.clinic_id
    const role = (profile as { role?: string })?.role
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'member' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    let q = supabase
      .from('scheduled_outbound_calls')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .eq('status', 'scheduled')

    if (role === 'member') {
      q = q.eq('created_by', user.id)
    }

    const { data: row, error } = await q.select('*').maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Not found or not cancellable' }, { status: 404 })

    return NextResponse.json({ call: rowToApp(row as Record<string, unknown>) })
  } catch (e) {
    console.error('PATCH scheduled-outbound', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
