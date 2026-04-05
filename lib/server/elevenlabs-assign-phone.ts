import type { AgentConfig } from '@/lib/types'
import { isPlaceholderOrMissingElevenLabsAgentId } from '@/lib/elevenlabs-placeholders'

/**
 * Point a ConvAI phone number at this clinic's inbound agent so inbound calls don't hang up.
 * See: PATCH /v1/convai/phone-numbers/{phone_number_id} with `agent_id`.
 */
export async function assignConvaiPhoneNumberToAgent(opts: {
  apiKey: string
  phoneNumberId: string
  agentId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { apiKey, phoneNumberId, agentId } = opts
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`,
    {
      method: 'PATCH',
      headers: { 'xi-api-key': apiKey.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    }
  )
  if (!res.ok) {
    const t = await res.text()
    return { ok: false, error: `PATCH convai/phone-numbers ${res.status}: ${t.slice(0, 500)}` }
  }
  return { ok: true }
}

/** Best-effort: after clinic settings change, bind the saved line to the saved agent. */
export async function ensureConvaiInboundLineAssignedToClinicAgent(
  apiKey: string | undefined,
  ac: AgentConfig | null | undefined
): Promise<void> {
  if (!apiKey?.trim() || !ac) return
  const pid = ac.elevenLabsPhoneNumberId?.trim()
  const aid = ac.elevenLabsAgentId?.trim()
  if (!pid || !aid || isPlaceholderOrMissingElevenLabsAgentId(aid)) return
  const r = await assignConvaiPhoneNumberToAgent({ apiKey: apiKey.trim(), phoneNumberId: pid, agentId: aid })
  if (!r.ok) {
    console.error('[ElevenLabs] assign inbound line to agent failed:', r.error)
  }
}
