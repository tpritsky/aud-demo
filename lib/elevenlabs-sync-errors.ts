const CONVAI_WRITE_HINT =
  'Your ElevenLabs API key needs ConvAI write access. In ElevenLabs: Developers → API keys → create or edit a key with permission to manage Conversational AI / Agents (often shown as convai_write), then set it as ELEVENLABS_API_KEY for this app.'

function needsConvaiWriteHint(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes('convai_write') || t.includes('missing_permissions')
}

/** Append when ElevenLabs returns 401 missing convai_write on agent PATCH. */
export function appendConvaiWriteHintIfRelevant(message: string): string {
  if (!needsConvaiWriteHint(message)) return message
  if (message.includes('Developers → API keys')) return message
  return `${message}\n\n${CONVAI_WRITE_HINT}`
}

/** Format API JSON from sync routes for user-visible toasts / logs. */
export function formatElevenLabsSyncFailureMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Sync failed'
  const o = data as Record<string, unknown>
  let base =
    (typeof o.error === 'string' && o.error) ||
    (typeof o.message === 'string' && o.message) ||
    'Sync failed'
  const results = o.results
  if (!Array.isArray(results) || results.length === 0) {
    return appendConvaiWriteHintIfRelevant(base)
  }
  const parts: string[] = []
  for (const r of results) {
    if (!r || typeof r !== 'object') continue
    const row = r as { ok?: boolean; agentId?: string; error?: string }
    if (row.ok !== false || !row.error) continue
    const id = typeof row.agentId === 'string' ? row.agentId : 'agent'
    const err = row.error.length > 320 ? `${row.error.slice(0, 320)}…` : row.error
    parts.push(`${id}: ${err}`)
  }
  if (!parts.length) return appendConvaiWriteHintIfRelevant(base)
  const joined = `${base}\n${parts.join('\n')}`
  return appendConvaiWriteHintIfRelevant(joined)
}
