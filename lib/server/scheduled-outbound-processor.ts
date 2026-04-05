import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/phone-format'
import type { AgentConfig } from '@/lib/types'

export type ScheduledRow = {
  id: string
  clinic_id: string
  created_by: string
  to_number: string
  call_goal: string
  call_reason: string | null
  patient_id: string | null
  extra_context: string | null
  attempt_count: number | null
  max_attempts: number | null
}

function parseAgentConfig(settings: unknown): AgentConfig | null {
  if (!settings || typeof settings !== 'object') return null
  const ac = (settings as { agentConfig?: AgentConfig }).agentConfig
  return ac && typeof ac === 'object' ? ac : null
}

export async function logScheduledOutboundEvent(
  supabase: ReturnType<typeof createServerClient>,
  row: { id: string; clinic_id: string },
  eventType: string,
  detail: Record<string, unknown>,
  log: string[]
) {
  const { error } = await supabase.from('scheduled_outbound_events').insert({
    scheduled_outbound_id: row.id,
    clinic_id: row.clinic_id,
    event_type: eventType,
    detail,
  })
  if (error && !error.message.includes('does not exist') && error.code !== '42P01') {
    log.push(`event:${row.id}:${error.message}`)
  }
}

/**
 * One full attempt: lock → dial → complete / retry / fail. Returns true if call completed.
 */
export async function processOneScheduledRow(
  supabase: ReturnType<typeof createServerClient>,
  apiKey: string,
  row: ScheduledRow,
  nowIso: string,
  log: string[]
): Promise<boolean> {
  const maxA = Math.min(10, Math.max(1, row.max_attempts ?? 3))
  const prev = row.attempt_count ?? 0
  if (prev >= maxA) {
    await supabase
      .from('scheduled_outbound_calls')
      .update({ status: 'failed', error_message: 'Max dial attempts reached' })
      .eq('id', row.id)
      .eq('status', 'scheduled')
    await logScheduledOutboundEvent(supabase, row, 'skipped_max_attempts', { prev, maxA }, log)
    return false
  }

  const nextAttempt = prev + 1
  const { error: lockErr } = await supabase
    .from('scheduled_outbound_calls')
    .update({
      status: 'processing',
      attempt_count: nextAttempt,
      last_attempt_at: nowIso,
      error_message: null,
    })
    .eq('id', row.id)
    .eq('status', 'scheduled')

  if (lockErr) {
    log.push(`${row.id}: lock failed ${lockErr.message}`)
    return false
  }

  await logScheduledOutboundEvent(supabase, row, 'dial_attempt', { attempt: nextAttempt, max_attempts: maxA }, log)

  const normalized = normalizePhoneNumber(row.to_number)
  if (!normalized.startsWith('+') || normalized.length < 11) {
    const msg = 'Invalid phone number'
    if (nextAttempt >= maxA) {
      await supabase
        .from('scheduled_outbound_calls')
        .update({ status: 'failed', error_message: msg, next_retry_at: null })
        .eq('id', row.id)
      await logScheduledOutboundEvent(supabase, row, 'dial_failed', { error: msg, terminal: true }, log)
    } else {
      const retryAt = new Date(Date.now() + Math.min(45, 5 * nextAttempt) * 60_000).toISOString()
      await supabase
        .from('scheduled_outbound_calls')
        .update({
          status: 'scheduled',
          error_message: msg,
          next_retry_at: retryAt,
        })
        .eq('id', row.id)
      await logScheduledOutboundEvent(supabase, row, 'retry_scheduled', { reason: msg, next_retry_at: retryAt }, log)
    }
    log.push(`${row.id}: bad phone`)
    return false
  }

  const { data: clinic } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', row.clinic_id)
    .maybeSingle()

  const agentConfig = parseAgentConfig((clinic as { settings?: unknown } | null)?.settings)
  const outboundAgentId = agentConfig?.elevenLabsOutboundAgentId || agentConfig?.elevenLabsAgentId
  const phoneId = agentConfig?.elevenLabsPhoneNumberId

  if (!outboundAgentId || !phoneId) {
    const msg = 'Clinic voice agent not configured (agent + phone ID in settings)'
    await supabase
      .from('scheduled_outbound_calls')
      .update({ status: 'failed', error_message: msg, next_retry_at: null })
      .eq('id', row.id)
    await logScheduledOutboundEvent(supabase, row, 'dial_failed', { error: msg, terminal: true }, log)
    log.push(`${row.id}: no agent config`)
    return false
  }

  const payload = {
    agent_id: outboundAgentId,
    agent_phone_number_id: phoneId,
    to_number: normalized,
    conversation_initiation_client_data: {
      dynamic_variables: {
        call_goal: row.call_goal,
        call_reason: row.call_reason || '',
        clinic_name: agentConfig?.clinicName || '',
        staff_context: (row.extra_context || '').slice(0, 2500),
      },
    },
  }

  const res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const t = await res.text()
    const msg = t.slice(0, 2000)
    if (nextAttempt >= maxA) {
      await supabase
        .from('scheduled_outbound_calls')
        .update({ status: 'failed', error_message: msg, next_retry_at: null })
        .eq('id', row.id)
      await logScheduledOutboundEvent(supabase, row, 'dial_failed', { status: res.status, terminal: true }, log)
    } else {
      const retryAt = new Date(Date.now() + Math.min(45, 5 * nextAttempt) * 60_000).toISOString()
      await supabase
        .from('scheduled_outbound_calls')
        .update({
          status: 'scheduled',
          error_message: msg,
          next_retry_at: retryAt,
        })
        .eq('id', row.id)
      await logScheduledOutboundEvent(
        supabase,
        row,
        'retry_scheduled',
        {
          status: res.status,
          next_retry_at: retryAt,
        },
        log
      )
    }
    log.push(`${row.id}: EL ${res.status}`)
    return false
  }

  const data = (await res.json()) as { conversation_id?: string }
  const conversationId = data.conversation_id

  if (conversationId) {
    const { error: claimErr } = await supabase.from('conversation_claims').upsert(
      { conversation_id: conversationId, user_id: row.created_by },
      { onConflict: 'conversation_id' }
    )
    if (claimErr) {
      log.push(`${row.id}: claim ${claimErr.message}`)
    }
  }

  await supabase
    .from('scheduled_outbound_calls')
    .update({
      status: 'completed',
      conversation_id: conversationId ?? null,
      error_message: null,
      next_retry_at: null,
    })
    .eq('id', row.id)

  await logScheduledOutboundEvent(supabase, row, 'dial_success', { conversation_id: conversationId ?? null }, log)
  log.push(`${row.id}: ok`)
  return true
}

/**
 * Process a single row by id (QStash / manual). No-op if not due or wrong status.
 */
export async function processScheduledOutboundById(id: string): Promise<{ completed: boolean; log: string[] }> {
  const log: string[] = []
  const supabase = createServerClient()
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    log.push('ELEVENLABS_API_KEY missing')
    return { completed: false, log }
  }

  const { data: raw, error } = await supabase
    .from('scheduled_outbound_calls')
    .select(
      'id, clinic_id, created_by, to_number, call_goal, call_reason, patient_id, extra_context, attempt_count, max_attempts, status, scheduled_for, next_retry_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !raw) {
    log.push('not found')
    return { completed: false, log }
  }

  const row = raw as ScheduledRow & {
    status: string
    scheduled_for: string
    next_retry_at: string | null
  }

  if (row.status !== 'scheduled') {
    log.push(`status=${row.status}`)
    return { completed: false, log }
  }

  const nowIso = new Date().toISOString()
  if (row.scheduled_for > nowIso) {
    log.push('not due yet')
    return { completed: false, log }
  }
  if (row.next_retry_at && row.next_retry_at > nowIso) {
    log.push('retry not due')
    return { completed: false, log }
  }

  const ok = await processOneScheduledRow(supabase, apiKey, row, nowIso, log)
  return { completed: ok, log }
}

/**
 * Fire due scheduled outbound rows via ElevenLabs (service role; for cron / internal use).
 */
export async function processDueScheduledOutboundCalls(limit = 8): Promise<{
  processed: number
  log: string[]
}> {
  const log: string[] = []
  const supabase = createServerClient()
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    log.push('ELEVENLABS_API_KEY missing; skip')
    return { processed: 0, log }
  }

  const now = new Date().toISOString()

  const { data: due, error } = await supabase
    .from('scheduled_outbound_calls')
    .select(
      'id, clinic_id, created_by, to_number, call_goal, call_reason, patient_id, extra_context, attempt_count, max_attempts'
    )
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) {
    log.push(`query error: ${error.message}`)
    return { processed: 0, log }
  }

  let processed = 0
  for (const raw of due || []) {
    const row = raw as ScheduledRow
    const done = await processOneScheduledRow(supabase, apiKey, row, now, log)
    if (done) processed += 1
  }

  return { processed, log }
}
