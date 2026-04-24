import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
} from '@/lib/clinic-call-ai'
import { deliverFollowUpFromLiveTool, type LiveFollowUpToolParams } from '@/lib/server/deliver-follow-up-messages'
import {
  fetchConvaiConversationAgentId,
  findClinicIdByElevenLabsAgentId,
} from '@/lib/server/convai-resolve-clinic'

/** LLM / JSON sometimes sends "true" instead of true. */
function coerceBool(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
  }
  return false
}

/**
 * ElevenLabs usually sends { conversation_id, parameters: { ... } }.
 * Some clients flatten tool args + conversation_id at the top level — accept both.
 */
function parseToolBody(raw: unknown):
  | { ok: true; conversationId: string; paramObj: Record<string, unknown> }
  | { ok: false; response: ReturnType<typeof NextResponse.json> } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }
  const b = raw as Record<string, unknown>
  const data = b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>) : null
  const conversationId =
    (typeof b.conversation_id === 'string' && b.conversation_id.trim()) ||
    (data && typeof data.conversation_id === 'string' && data.conversation_id.trim()) ||
    ''

  if (!conversationId) {
    return { ok: false, response: NextResponse.json({ error: 'conversation_id required' }, { status: 400 }) }
  }

  const toolKeys = [
    'template_id',
    'caller_confirmed',
    'send_sms',
    'send_email',
    'destination_email',
    'caller_phone_e164',
  ] as const
  const merge: Record<string, unknown> = {}
  if (b.parameters && typeof b.parameters === 'object' && b.parameters !== null) {
    Object.assign(merge, b.parameters as Record<string, unknown>)
  }
  if (data) {
    for (const k of toolKeys) {
      const v = (data as Record<string, unknown>)[k]
      if (v !== undefined && v !== null) merge[k] = v
    }
  }
  for (const k of toolKeys) {
    const v = b[k]
    if (v !== undefined && v !== null && (merge[k] === undefined || merge[k] === '')) {
      merge[k] = v
    }
  }
  if (Object.keys(merge).length === 0) {
    return { ok: false, response: NextResponse.json({ error: 'parameters required' }, { status: 400 }) }
  }
  return { ok: true, conversationId, paramObj: merge }
}

function followUpDebug(): boolean {
  return process.env.DEBUG_CONVAI_FOLLOWUP === '1'
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseToolBody(body)
  if (!parsed.ok) {
    if (followUpDebug()) {
      try {
        console.error('[convai/send-follow-up][debug] bad body shape keys=', body && typeof body === 'object' ? Object.keys(body as object) : [])
      } catch {
        // ignore
      }
    }
    return parsed.response
  }

  const { conversationId, paramObj: p } = parsed
  if (followUpDebug()) {
    console.error(
      '[convai/send-follow-up][debug] hit conversation_id=',
      conversationId.slice(0, 20),
      'template_id=',
      typeof p.template_id === 'string' ? p.template_id.slice(0, 12) : '(none)'
    )
  }

  const params: LiveFollowUpToolParams = {
    template_id: typeof p.template_id === 'string' ? p.template_id : '',
    caller_confirmed: coerceBool(p.caller_confirmed),
    send_sms: coerceBool(p.send_sms),
    send_email: coerceBool(p.send_email),
    destination_email: typeof p.destination_email === 'string' ? p.destination_email : undefined,
    caller_phone_e164: typeof p.caller_phone_e164 === 'string' ? p.caller_phone_e164 : undefined,
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    console.error('[convai/send-follow-up] ELEVENLABS_API_KEY missing')
    return NextResponse.json({ result: 'Server is missing ElevenLabs configuration.' }, { status: 503 })
  }

  /** Trust agent_id only after we match ElevenLabs’ record for this conversation (no shared webhook secret). */
  const { agentId: agentIdFromEl, status: elConversationStatus } = await fetchConvaiConversationAgentId(
    apiKey,
    conversationId
  )
  if (!agentIdFromEl) {
    const elAuthFailed = elConversationStatus === 401 || elConversationStatus === 403
    if (elAuthFailed) {
      console.error(
        '[convai/send-follow-up] ElevenLabs conversation lookup failed with',
        elConversationStatus,
        '— fix ELEVENLABS_API_KEY on the server.'
      )
    }
    return NextResponse.json({
      result:
        'You could not send that message from this call. Apologize kindly and offer that the office can send the same text or email shortly. Keep your explanation brief and non-technical.',
    })
  }

  const agentId = agentIdFromEl

  const supabase = createServerClient()
  const clinic = await findClinicIdByElevenLabsAgentId(supabase, agentId)
  if (!clinic) {
    return NextResponse.json({
      result: 'No clinic is linked to this phone agent. Ask an admin to save receptionist settings and push to the line.',
    })
  }

  const { data: clinicRow, error: cErr } = await supabase
    .from('clinics')
    .select('settings, vertical, name')
    .eq('id', clinic.clinicId)
    .maybeSingle()

  if (cErr || !clinicRow) {
    console.error('[convai/send-follow-up] clinic load', cErr?.message)
    return NextResponse.json({ result: 'Could not load clinic settings.' })
  }

  const c = clinicRow as { settings?: unknown; vertical?: string; name?: string }
  const vertical = normalizeVertical(c.vertical)
  const { callAi: partialAi } = parseClinicSettingsBlob(c.settings)
  const callAi = mergeCallAiSettings(vertical, partialAi)
  const clinicName = typeof c.name === 'string' ? c.name : clinic.clinicName

  const out = await deliverFollowUpFromLiveTool({
    supabase,
    conversationId,
    clinicName,
    templates: callAi.textMessageTemplates ?? [],
    params,
  })

  if (followUpDebug()) {
    console.error('[convai/send-follow-up][debug] deliver ok=', out.ok, 'result_len=', out.result.length)
  } else if (!out.ok) {
    console.warn('[convai/send-follow-up] not sent:', out.result.slice(0, 300))
  }

  return NextResponse.json({ result: out.result })
}
