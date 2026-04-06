import Anthropic from '@anthropic-ai/sdk'

/**
 * Call transcript post-processing via Anthropic Claude (Haiku by default).
 *
 * Env:
 * - CALUDE_CALL_SUMMARY_KEY1 or ANTHROPIC_API_KEY (required)
 * - ANTHROPIC_CALL_MODEL (optional, default claude-haiku-4-5)
 */

export type FollowUpMessageIntent = {
  template_id: string
  caller_confirmed: boolean
  send_sms: boolean
  send_email: boolean
  destination_email: string | null
}

export type CallPostProcessResult = {
  caller_name: string | null
  caller_phone: string | null
  brief_summary: string
  /** 1 = lowest … 4 = respond immediately */
  response_urgency: 1 | 2 | 3 | 4
  /** 1 = lowest … 4 = highest upside for the business */
  business_value: 1 | 2 | 3 | 4
  tags: string[]
  /** Post-call SMS/email sends (clinic templates + caller consent). */
  follow_up_messages: FollowUpMessageIntent[]
}

const DEFAULT_MODEL = 'claude-haiku-4-5'

const BASE_SYSTEM = `You analyze phone call transcripts for a clinic / business phone line.
Extract structured facts for staff triage. Be conservative: if unsure, use null for name/phone and lower scores.
Urgency: 1=routine, 2=soon, 3=same day, 4=immediate callback.
Business value: 1=low, 2=moderate, 3=high, 4=strategic revenue or retention risk.
Tags: short lowercase snake_case labels (e.g. billing_question, new_patient, hearing_aid_issue). Max 8 tags.
If follow-up message templates are listed in clinic guidance, you may populate follow_up_messages only when the caller clearly consented; otherwise use an empty array.
For each follow-up row: honor each template's delivery_channels rules from clinic guidance. When email delivery is allowed and the transcript contains an email the caller provided, set send_email true and destination_email to that exact address (do not invent addresses).`

function getClient(): Anthropic {
  const key = process.env.CALUDE_CALL_SUMMARY_KEY1 || process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('Missing CALUDE_CALL_SUMMARY_KEY1 or ANTHROPIC_API_KEY')
  }
  return new Anthropic({ apiKey: key })
}

function toolSchema(): Anthropic.Messages.Tool {
  return {
    name: 'submit_call_analysis',
    description: 'Return structured analysis of the call.',
    input_schema: {
      type: 'object',
      properties: {
        caller_name: {
          type: ['string', 'null'],
          description: 'Caller name if stated or strongly implied; else null.',
        },
        caller_phone: {
          type: ['string', 'null'],
          description: 'Phone number as spoken or digits; null if not given.',
        },
        brief_summary: {
          type: 'string',
          description: 'One or two sentences for the team.',
        },
        response_urgency: {
          type: 'integer',
          description: '1–4, higher = more urgent to respond.',
          minimum: 1,
          maximum: 4,
        },
        business_value: {
          type: 'integer',
          description: '1–4, higher = more valuable to the business.',
          minimum: 1,
          maximum: 4,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Short labels for filtering.',
        },
        follow_up_messages: {
          type: 'array',
          description:
            'Templates the caller consented to receive after the call. Empty if none or no templates configured.',
          items: {
            type: 'object',
            properties: {
              template_id: {
                type: 'string',
                description: 'Exact template_id from the clinic follow-up list.',
              },
              caller_confirmed: {
                type: 'boolean',
                description: 'True only if the caller explicitly agreed to receive this.',
              },
              send_sms: {
                type: 'boolean',
                description:
                  'True when template allows SMS and caller consented; use false when template is email-only.',
              },
              send_email: {
                type: 'boolean',
                description:
                  'True when template allows email or both, caller consented, and transcript includes their email. Must be false when template is SMS-only.',
              },
              destination_email: {
                type: ['string', 'null'],
                description:
                  'Required when send_email is true: copy the caller email from the transcript (e.g. user@domain.com). Null otherwise.',
              },
            },
            required: ['template_id', 'caller_confirmed', 'send_sms', 'send_email', 'destination_email'],
          },
        },
      },
      required: [
        'caller_name',
        'caller_phone',
        'brief_summary',
        'response_urgency',
        'business_value',
        'tags',
        'follow_up_messages',
      ],
    },
  }
}

function normalizeFollowUpMessages(raw: unknown): FollowUpMessageIntent[] {
  if (!Array.isArray(raw)) return []
  const out: FollowUpMessageIntent[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.template_id !== 'string' || !o.template_id.trim()) continue
    const dest =
      typeof o.destination_email === 'string' && o.destination_email.trim()
        ? o.destination_email.trim().slice(0, 320)
        : null
    out.push({
      template_id: o.template_id.trim().slice(0, 80),
      caller_confirmed: o.caller_confirmed === true,
      send_sms: o.send_sms === true,
      send_email: o.send_email === true,
      destination_email: dest,
    })
    if (out.length >= 5) break
  }
  return out
}

function normalizeResult(raw: Record<string, unknown>): CallPostProcessResult {
  const u = Number(raw.response_urgency)
  const v = Number(raw.business_value)
  const urgency = u >= 1 && u <= 4 ? (Math.round(u) as 1 | 2 | 3 | 4) : 2
  const value = v >= 1 && v <= 4 ? (Math.round(v) as 1 | 2 | 3 | 4) : 2
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string').slice(0, 12)
    : []
  return {
    caller_name: typeof raw.caller_name === 'string' ? raw.caller_name : null,
    caller_phone: typeof raw.caller_phone === 'string' ? raw.caller_phone : null,
    brief_summary: typeof raw.brief_summary === 'string' ? raw.brief_summary : '',
    response_urgency: urgency,
    business_value: value,
    tags,
    follow_up_messages: normalizeFollowUpMessages(raw.follow_up_messages),
  }
}

export type PostProcessCallOptions = {
  /** Override model (default from ANTHROPIC_CALL_MODEL or Haiku) */
  model?: string
  /** Optional clinic context for better tagging */
  clinicName?: string
  /** Merged vertical + admin “what to look for” + playbooks (from clinics.settings) */
  extraClinicContext?: string
}

/**
 * Run Claude on a call transcript and return structured triage fields.
 */
export async function postProcessCallTranscript(
  transcript: string,
  options: PostProcessCallOptions = {}
): Promise<CallPostProcessResult> {
  const trimmed = transcript.trim()
  if (!trimmed) {
    return {
      caller_name: null,
      caller_phone: null,
      brief_summary: 'No transcript provided.',
      response_urgency: 1,
      business_value: 1,
      tags: ['empty_transcript'],
      follow_up_messages: [],
    }
  }

  const model = options.model ?? process.env.ANTHROPIC_CALL_MODEL ?? DEFAULT_MODEL
  const client = getClient()

  const system =
    options.extraClinicContext?.trim() != null && options.extraClinicContext.trim() !== ''
      ? `${BASE_SYSTEM}\n\nClinic-specific guidance (from staff configuration):\n${options.extraClinicContext.trim()}`
      : BASE_SYSTEM

  const userParts: string[] = []
  if (options.clinicName) {
    userParts.push(`Business / clinic name (for context): ${options.clinicName}`)
  }
  userParts.push('Transcript:\n---\n', trimmed, '\n---\nCall submit_call_analysis with your analysis.')

  const message = await client.messages.create({
    model,
    max_tokens: 1536,
    system,
    tools: [toolSchema()],
    tool_choice: { type: 'tool', name: 'submit_call_analysis' },
    messages: [{ role: 'user', content: userParts.join('\n') }],
  })

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'submit_call_analysis') {
      return normalizeResult(block.input as Record<string, unknown>)
    }
  }

  throw new Error('Claude did not return submit_call_analysis tool output')
}
