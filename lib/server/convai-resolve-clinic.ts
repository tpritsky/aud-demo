import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Find a clinic whose stored agentConfig references this ConvAI agent (inbound or outbound id).
 */
export async function findClinicIdByElevenLabsAgentId(
  supabase: SupabaseClient,
  agentId: string
): Promise<{ clinicId: string; clinicName: string } | null> {
  const id = agentId.trim()
  if (!id) return null

  const { data, error } = await supabase
    .from('clinics')
    .select('id, name')
    .or(
      `settings->agentConfig->>elevenLabsAgentId.eq.${id},settings->agentConfig->>elevenLabsOutboundAgentId.eq.${id}`
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[convai resolve clinic]', error.message)
    return null
  }
  const row = data as { id?: string; name?: string } | null
  if (!row?.id) return null
  return { clinicId: row.id, clinicName: typeof row.name === 'string' ? row.name : '' }
}

/**
 * Resolve agent_id for a conversation using the same ElevenLabs API key as sync.
 * Used to authenticate ConvAI webhook calls without a separate webhook secret.
 */
export async function fetchConvaiConversationAgentId(
  apiKey: string,
  conversationId: string
): Promise<string | null> {
  const cid = conversationId.trim()
  if (!cid) return null
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(cid)}`,
    { headers: { 'xi-api-key': apiKey.trim() } }
  )
  if (!res.ok) {
    console.warn('[convai conversation]', cid.slice(0, 12), res.status)
    return null
  }
  try {
    const j = (await res.json()) as Record<string, unknown>
    const aid =
      typeof j.agent_id === 'string'
        ? j.agent_id
        : typeof j.agentId === 'string'
          ? j.agentId
          : typeof (j.agent as Record<string, unknown> | undefined)?.agent_id === 'string'
            ? ((j.agent as Record<string, unknown>).agent_id as string)
            : ''
    return aid.trim() || null
  } catch {
    return null
  }
}
