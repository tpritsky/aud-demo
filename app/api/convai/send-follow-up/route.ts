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

function parseToolBody(raw: unknown): {
  conversation_id?: string
  parameters?: LiveFollowUpToolParams & Record<string, unknown>
} {
  if (!raw || typeof raw !== 'object') return {}
  return raw as {
    conversation_id?: string
    parameters?: LiveFollowUpToolParams & Record<string, unknown>
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseToolBody(body)
  const conversationId = typeof parsed.conversation_id === 'string' ? parsed.conversation_id.trim() : ''
  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
  }

  const p = parsed.parameters
  if (!p || typeof p !== 'object') {
    return NextResponse.json({ error: 'parameters required' }, { status: 400 })
  }

  const params: LiveFollowUpToolParams = {
    template_id: typeof p.template_id === 'string' ? p.template_id : '',
    caller_confirmed: p.caller_confirmed === true,
    send_sms: p.send_sms === true,
    send_email: p.send_email === true,
    destination_email: typeof p.destination_email === 'string' ? p.destination_email : undefined,
    caller_phone_e164: typeof p.caller_phone_e164 === 'string' ? p.caller_phone_e164 : undefined,
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    console.error('[convai/send-follow-up] ELEVENLABS_API_KEY missing')
    return NextResponse.json({ result: 'Server is missing ElevenLabs configuration.' }, { status: 503 })
  }

  /** Trust agent_id only after we match ElevenLabs’ record for this conversation (no shared webhook secret). */
  const agentIdFromEl = (await fetchConvaiConversationAgentId(apiKey, conversationId)) || ''
  if (!agentIdFromEl) {
    return NextResponse.json({
      result: 'Could not verify this call with ElevenLabs. Try again in a moment.',
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

  return NextResponse.json({ result: out.result })
}
