import type { AgentConfig, ClinicVertical } from '@/lib/types'
import { defaultAgentConfig } from '@/lib/data'
import { parseClinicSettingsBlob } from '@/lib/clinic-call-ai'
import { isPlaceholderOrMissingElevenLabsAgentId } from '@/lib/elevenlabs-placeholders'

export type ConvaiPhoneRow = {
  phoneNumberId: string
  phoneNumber: string
  /** ConvAI agent_id this line routes inbound to; missing = unassigned / misconfigured */
  assignedAgentId?: string
}

function parseAssignedAgentId(o: Record<string, unknown>): string | undefined {
  const aa = o.assigned_agent
  if (!aa || typeof aa !== 'object') return undefined
  const id = (aa as Record<string, unknown>).agent_id
  return typeof id === 'string' && id.trim() ? id.trim() : undefined
}

function parsePhoneRows(json: unknown): ConvaiPhoneRow[] {
  const rawList = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).phone_numbers)
      ? ((json as Record<string, unknown>).phone_numbers as unknown[])
      : []
  const out: ConvaiPhoneRow[] = []
  for (const row of rawList) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const phoneNumberId = typeof o.phone_number_id === 'string' ? o.phone_number_id.trim() : ''
    const phoneNumber = typeof o.phone_number === 'string' ? o.phone_number.trim() : ''
    if (!phoneNumberId || !phoneNumber) continue
    const assignedAgentId = parseAssignedAgentId(o)
    out.push({ phoneNumberId, phoneNumber, ...(assignedAgentId ? { assignedAgentId } : {}) })
  }
  return out
}

/** `null` = ElevenLabs request failed (do not clear stored UI state). */
export async function fetchConvaiPhoneNumberRows(apiKey: string): Promise<ConvaiPhoneRow[] | null> {
  const res = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
    headers: { 'xi-api-key': apiKey.trim() },
  })
  if (!res.ok) return null
  const text = await res.text()
  try {
    return parsePhoneRows(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

export function resolvePhoneNumberForLineId(rows: ConvaiPhoneRow[], phoneNumberId: string): string | null {
  const id = phoneNumberId.trim()
  if (!id) return null
  const hit = rows.find((r) => r.phoneNumberId === id)
  return hit?.phoneNumber?.trim() || null
}

export function convaiLineInboundLinkedToAgent(
  rows: ConvaiPhoneRow[],
  lineId: string,
  clinicAgentId: string
): boolean {
  const hit = rows.find((r) => r.phoneNumberId === lineId.trim())
  if (!hit) return false
  const assigned = hit.assignedAgentId?.trim()
  if (!assigned) return false
  return assigned === clinicAgentId.trim()
}

/**
 * Set display `phoneNumber` from ElevenLabs only when this ConvAI line is assigned to this clinic's inbound agent.
 * Otherwise clear `phoneNumber` so we don't show a callable number that hangs up (wrong/unassigned agent).
 */
export async function resolvePublicPhoneForAgentConfig(
  apiKey: string | undefined,
  ac: AgentConfig | null | undefined
): Promise<AgentConfig | null> {
  if (!ac || !apiKey?.trim()) return ac ?? null
  const lineId = ac.elevenLabsPhoneNumberId?.trim()
  if (!lineId) return ac

  const agentId = ac.elevenLabsAgentId?.trim() || ''
  if (!agentId || isPlaceholderOrMissingElevenLabsAgentId(agentId)) {
    return ac.phoneNumber?.trim() ? { ...ac, phoneNumber: '' } : ac
  }

  const rows = await fetchConvaiPhoneNumberRows(apiKey)
  if (rows === null) return ac

  const hit = rows.find((r) => r.phoneNumberId === lineId)
  if (!hit) {
    return ac.phoneNumber?.trim() ? { ...ac, phoneNumber: '' } : ac
  }

  if (!convaiLineInboundLinkedToAgent(rows, lineId, agentId)) {
    return ac.phoneNumber?.trim() ? { ...ac, phoneNumber: '' } : ac
  }

  const e164 = hit.phoneNumber.trim()
  const current = ac.phoneNumber?.trim() || ''
  if (current === e164) return ac
  return { ...ac, phoneNumber: e164.slice(0, 80) }
}

/** Default outbound ConvAI agent to inbound when unset (typical single-agent setup). */
export function normalizeClinicAgentIds(ac: AgentConfig | null | undefined): AgentConfig | null {
  if (!ac) return null
  const inbound = ac.elevenLabsAgentId?.trim() || ''
  if (!inbound || isPlaceholderOrMissingElevenLabsAgentId(inbound)) return { ...ac }
  const out = { ...ac }
  const ob = out.elevenLabsOutboundAgentId?.trim() || ''
  if (!ob || isPlaceholderOrMissingElevenLabsAgentId(ob)) {
    out.elevenLabsOutboundAgentId = inbound
  }
  return out
}

/** Deep-merge defaults + optional auto-provision (replace demo agent IDs) + normalize IDs + resolve phone from ElevenLabs. */
export async function enrichClinicSettingsAgentConfig(
  settings: Record<string, unknown>,
  vertical: ClinicVertical = 'general'
): Promise<Record<string, unknown>> {
  let working: Record<string, unknown> = { ...settings }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (apiKey) {
    const { provisionAgentIfPlaceholderInSettings } = await import('@/lib/server/elevenlabs-create-agent')
    const provisioned = await provisionAgentIfPlaceholderInSettings({
      settings: working,
      vertical,
      apiKey,
    })
    if (provisioned.changed) {
      working = provisioned.settings
      if (provisioned.error) {
        console.error('[ElevenLabs] provision while enriching settings:', provisioned.error)
      }
    }
  }

  const { agentConfig: rawAc } = parseClinicSettingsBlob(working)
  if (!rawAc) return working
  let next: AgentConfig = { ...defaultAgentConfig, ...rawAc }
  const normalized = normalizeClinicAgentIds(next)
  if (normalized) next = normalized
  if (apiKey) {
    const withPhone = await resolvePublicPhoneForAgentConfig(apiKey, next)
    if (withPhone) next = withPhone
  }
  return { ...working, agentConfig: next }
}

export function clinicAgentConfigEnrichmentChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): boolean {
  const a = before.agentConfig as AgentConfig | undefined
  const b = after.agentConfig as AgentConfig | undefined
  if (!a && !b) return false
  if (!a || !b) return true
  return (
    (a.phoneNumber?.trim() || '') !== (b.phoneNumber?.trim() || '') ||
    (a.elevenLabsOutboundAgentId?.trim() || '') !== (b.elevenLabsOutboundAgentId?.trim() || '') ||
    (a.elevenLabsAgentId?.trim() || '') !== (b.elevenLabsAgentId?.trim() || '')
  )
}
