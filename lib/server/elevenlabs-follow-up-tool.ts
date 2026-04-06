/**
 * ConvAI workspace webhook tool: sends follow-up SMS/email during a live call.
 * Auth: `/api/convai/send-follow-up` verifies `conversation_id` via ElevenLabs API (ELEVENLABS_API_KEY).
 * Needs a public app URL (NEXT_PUBLIC_APP_URL or VERCEL_URL) to register the webhook URL. Optional: ELEVENLABS_SEND_FOLLOWUP_TOOL_ID.
 */

export const SEND_FOLLOW_UP_TOOL_NAME = 'send_follow_up_now'

function appBaseUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim() || ''
  if (u && !u.includes('localhost')) return u.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v && !v.includes('localhost')) return `https://${v.replace(/\/$/, '')}`
  return null
}

async function listConvaiTools(apiKey: string): Promise<{ id: string; name?: string }[]> {
  const res = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) return []
  const data = (await res.json()) as unknown
  const raw = Array.isArray(data) ? data : (data as { tools?: unknown })?.tools
  if (!Array.isArray(raw)) return []
  const out: { id: string; name?: string }[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : typeof o.tool_id === 'string' ? o.tool_id : ''
    if (!id) continue
    const cfg = o.tool_config && typeof o.tool_config === 'object' ? (o.tool_config as Record<string, unknown>) : o
    const name = typeof cfg.name === 'string' ? cfg.name : undefined
    out.push({ id, name })
  }
  return out
}

async function createSendFollowUpTool(
  apiKey: string,
  webhookUrl: string
): Promise<{ ok: true; toolId: string } | { ok: false; error: string }> {
  const body = {
    tool_config: {
      type: 'webhook',
      name: SEND_FOLLOW_UP_TOOL_NAME,
      description:
        'Send follow-up SMS and/or email **immediately** during the live call — never defer to after hangup. Call as soon as the caller agreed to that specific canned template and you verified contact details (read-back rules in the managed prompt). Required: exact template_id from the clinic list, caller_confirmed true, send_sms/send_email matching the template, plus caller_phone_e164 and/or destination_email. After success, tell the caller it was just sent now—not later.',
      execution_mode: 'immediate',
      api_schema: {
        url: webhookUrl,
        method: 'POST',
        content_type: 'application/json',
        request_body_schema: {
          type: 'object',
          required: ['template_id', 'caller_confirmed'],
          properties: {
            template_id: {
              type: 'string',
              description: 'UUID of the template from the clinic configuration (must match exactly).',
            },
            caller_confirmed: {
              type: 'boolean',
              description: 'True only if the caller explicitly agreed to this message on this call.',
            },
            send_sms: {
              type: 'boolean',
              description: 'Set true to send SMS when the template allows SMS and you have a valid E.164 phone.',
            },
            send_email: {
              type: 'boolean',
              description: 'Set true to send email when the template allows email and you have a valid address.',
            },
            destination_email: {
              type: 'string',
              description: 'Full email address the caller confirmed for this send (required when send_email is true).',
            },
            caller_phone_e164: {
              type: 'string',
              description:
                'E.164 phone number to text, e.g. +15551234567 — required when send_sms is true unless the channel is email-only.',
            },
          },
        },
      },
    },
  }

  const res = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, error: `create tool ${res.status}: ${text.slice(0, 600)}` }
  }
  try {
    const j = JSON.parse(text) as { id?: string; tool_id?: string }
    const toolId = typeof j.id === 'string' ? j.id : typeof j.tool_id === 'string' ? j.tool_id : ''
    if (!toolId) return { ok: false, error: 'create tool: missing id in response' }
    return { ok: true, toolId }
  } catch {
    return { ok: false, error: 'create tool: invalid JSON response' }
  }
}

/** Resolve tool id without creating (for stripping from agent when timing = after_call). */
export async function findSendFollowUpToolId(apiKey: string): Promise<string | null> {
  const envId = process.env.ELEVENLABS_SEND_FOLLOWUP_TOOL_ID?.trim()
  if (envId) return envId
  const listed = await listConvaiTools(apiKey.trim())
  return listed.find((t) => t.name === SEND_FOLLOW_UP_TOOL_NAME)?.id ?? null
}

/**
 * Returns the workspace tool id for the send-follow-up webhook, or null if live send is not configured.
 */
export async function ensureSendFollowUpWebhookTool(apiKey: string): Promise<string | null> {
  const existing = await findSendFollowUpToolId(apiKey)
  if (existing) return existing

  const base = appBaseUrl()
  if (!base) {
    console.warn(
      '[convai follow-up tool] Skip: set NEXT_PUBLIC_APP_URL or deploy on Vercel (VERCEL_URL) so the webhook URL is public.'
    )
    return null
  }

  const webhookUrl = `${base}/api/convai/send-follow-up`
  const created = await createSendFollowUpTool(apiKey.trim(), webhookUrl)
  if (!created.ok) {
    console.error('[convai follow-up tool]', created.error)
    return null
  }
  console.log(
    '[convai follow-up tool] Created tool',
    created.toolId,
    '- set ELEVENLABS_SEND_FOLLOWUP_TOOL_ID in env to skip future lookups.'
  )
  return created.toolId
}

export function clinicHasDeliverableFollowUpTemplates(callAi: { textMessageTemplates?: { enabled?: boolean }[] }): boolean {
  const list = callAi.textMessageTemplates ?? []
  return list.some((t) => t.enabled !== false)
}
