import type { ClinicCallAiSettings, ClinicVertical } from '@/lib/types'
import {
  formatCustomSummaryForLiveVoice,
  formatKnowledgeForPrompt,
  formatPostProcessingForLiveVoice,
  formatSummaryFocusForLiveVoice,
  formatTextMessageTemplatesForPrompt,
} from '@/lib/clinic-call-ai'
import { expandVoiceCallFlowToGuidance } from '@/lib/voice-call-flow'
import {
  clinicHasDeliverableFollowUpTemplates,
  ensureSendFollowUpWebhookTool,
  findSendFollowUpToolId,
} from '@/lib/server/elevenlabs-follow-up-tool'

const SYNC_START = '<<<AUD_APP_MANAGED_PROMPT_START>>>'
const SYNC_END = '<<<AUD_APP_MANAGED_PROMPT_END>>>'

export function stripManagedPromptBlock(prompt: string): string {
  const re = new RegExp(
    `[\\r\\n]*${SYNC_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SYNC_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\r\\n]*`,
    'g'
  )
  return prompt.replace(re, '').trim()
}

export function buildManagedPromptBlock(
  vertical: ClinicVertical,
  callAi: ClinicCallAiSettings,
  opts?: { liveFollowUpToolEnabled?: boolean; followUpSendTiming?: 'during_call' | 'after_call' }
): string {
  const knowledge = formatKnowledgeForPrompt(callAi)
  const flow = expandVoiceCallFlowToGuidance(callAi.callFlow)
  const textTemplates = formatTextMessageTemplatesForPrompt(callAi)
  const summaryFocus = formatSummaryFocusForLiveVoice(callAi)
  const customSummary = formatCustomSummaryForLiveVoice(callAi)
  const postProc = formatPostProcessingForLiveVoice(callAi)
  const staffDocBody = [
    summaryFocus.trim() || '(No extra summary themes selected — use sound judgment.)',
    customSummary.trim(),
    postProc.trim(),
  ]
    .filter((s) => s.length > 0)
    .join('\n\n')
  const staffDocSection = `## Staff priorities & staff-written instructions\n\n${staffDocBody}`

  const timing =
    opts?.followUpSendTiming ??
    (callAi.followUpSendTiming === 'after_call' ? 'after_call' : 'during_call')

  const deliverySection =
    timing === 'after_call'
      ? [
          '**Delivery timing (staff setting): AFTER the call only.** Do **not** call `send_follow_up_now` — that path is disabled for this business. Collect clear consent and accurate contact details (read-back rules below). Tell the caller their SMS and/or email will be sent **after the call ends**, once the system processes the conversation — check spam for email. Do not promise an instant send during the call.',
          '',
          '**Post-call delivery:** The transcript is analyzed automatically; SMS goes through Twilio and email through **Resend** (same transactional email service as the dashboard test message).',
        ].join('\n')
      : opts?.liveFollowUpToolEnabled
        ? [
            '**IMMEDIATE DELIVERY (staff setting: during the call):** This agent has the `send_follow_up_now` tool. For every agreed template (SMS and/or email), you **must** call that tool **during this call** as soon as consent and contact details are confirmed — usually in the **same turn**, before you tell them it is sent.',
            '',
            '**How sending works:** The tool calls this app’s server, which sends email with **Resend** and SMS with **Twilio** — the same stack as “Send a test message” in settings. You only pass parameters; you do not connect to Resend yourself.',
            '',
            '**Forbidden when this tool exists:** Do **not** tell the caller the message will arrive "after the call," "when we hang up," "shortly," "automatically later," or "in a few minutes" unless the tool has just failed and you are honestly offering a fallback.',
            '',
            '**What to say after a successful tool call:** Say the email or text **was just sent** and they should check their inbox or messages **now** (and spam/junk for email).',
            '',
            '**Tool parameters:** Exact `template_id` from the list above; `caller_confirmed: true`; `send_sms` / `send_email` must match that template’s delivery channels and what they asked for. For SMS include `caller_phone_e164` in E.164 (e.g. +15551234567). For email include full `destination_email` you verified with them.',
            '',
            '**Backup (silent):** The system may still try from the transcript after the call only if something was not sent live — do not **describe** that as the primary plan when this tool succeeds.',
          ].join('\n')
        : [
            '**Delivery timing (staff setting: during the call), but the live tool is not attached yet.** Deploy with a public URL (`NEXT_PUBLIC_APP_URL` or Vercel) and `ELEVENLABS_API_KEY`, then **push from the app** to attach `send_follow_up_now`. Until then, say the message will follow **after the call** from the transcript — speak emails clearly. Email still uses **Resend** and SMS **Twilio** on the server once processing runs.',
          ].join('\n')

  return [
    '',
    SYNC_START,
    `[Clinic vertical: ${vertical}]`,
    '',
    '**Clinic configuration (below):** Everything in this block was set by this business in the app. Treat it as binding operating policy — not optional suggestions. If something conflicts with a generic default, follow this block.',
    '',
    '## Knowledge',
    knowledge.trim() || '(Add knowledge cards in the app — hours, services, policies.)',
    '',
    '## Canned follow-up messages (SMS / email)',
    textTemplates.trim() || '(Optional — add templates under Text & email in the app.)',
    '',
    deliverySection,
    '',
    staffDocSection,
    '',
    '## How callers should be handled',
    flow,
    '',
    '## Inbound handling (additional notes)',
    callAi.inboundPlaybook?.trim() || '(optional)',
    '',
    '## Outbound handling (additional notes)',
    callAi.outboundPlaybook?.trim() || '(optional)',
    '',
    '## When to end the call',
    callAi.hangupGuidance?.trim() || '(not set in app)',
    '',
    'Per-call dynamic variables (injected by the app): {{staff_context}} repeats key clinic settings (knowledge, flow, templates index, summary priorities, staff notes) for this call — treat it as authoritative alongside this block. Also: {{hangup_guidance}}, {{clinic_vertical}}, {{call_goal}}, {{call_reason}}, {{clinic_name}}, {{patient_name}}',
    SYNC_END,
    '',
  ]
    .filter(Boolean)
    .join('\n')
}

function extractPromptFromAgentJson(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const o = data as Record<string, unknown>
  const cc = o.conversation_config as Record<string, unknown> | undefined
  const agent = cc?.agent as Record<string, unknown> | undefined
  const prompt = agent?.prompt as Record<string, unknown> | undefined
  const p = prompt?.prompt
  if (typeof p === 'string') return p
  const first = agent?.first_message
  if (typeof first === 'string') return first
  return ''
}

/** Deep-clone JSON-serializable config from GET so PATCH does not mutate cached objects. */
function cloneJson<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v)) as T
  } catch {
    return v
  }
}

/**
 * ElevenLabs GET agents return `prompt.tools` (legacy) alongside `tool_ids`.
 * PATCH validation often rejects sending both; OpenAPI says to use tool_ids only.
 */
function sanitizePromptForPatch(pr: Record<string, unknown>, nextPromptText: string): Record<string, unknown> {
  const out = cloneJson(pr) as Record<string, unknown>
  if (Array.isArray(out.tool_ids) && 'tools' in out) {
    delete out.tools
  }
  out.prompt = nextPromptText
  return out
}

/**
 * GET convai agent, merge managed playbook block into system prompt, PATCH back.
 */
export async function syncElevenLabsAgentPrompt(opts: {
  agentId: string
  apiKey: string
  vertical: ClinicVertical
  callAi: ClinicCallAiSettings
  /** Pushed to ConvAI `conversation_config.tts.speed` when the agent exposes `tts`. */
  speechSpeed?: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { agentId, apiKey, vertical, callAi, speechSpeed } = opts
  const baseUrl = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`

  const getRes = await fetch(baseUrl, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!getRes.ok) {
    const t = await getRes.text()
    return { ok: false, error: `GET agent ${getRes.status}: ${t.slice(0, 500)}` }
  }

  const agentJson = (await getRes.json()) as Record<string, unknown>
  const current = extractPromptFromAgentJson(agentJson)
  const stripped = stripManagedPromptBlock(current)

  const wantLiveTool =
    clinicHasDeliverableFollowUpTemplates(callAi) && callAi.followUpSendTiming !== 'after_call'

  const knownToolId = await findSendFollowUpToolId(apiKey)
  const followUpToolId = wantLiveTool ? await ensureSendFollowUpWebhookTool(apiKey) : null
  const liveAttached = wantLiveTool && Boolean(followUpToolId)

  const nextPrompt = (
    stripped +
    buildManagedPromptBlock(vertical, callAi, {
      liveFollowUpToolEnabled: liveAttached,
      followUpSendTiming: callAi.followUpSendTiming === 'after_call' ? 'after_call' : 'during_call',
    })
  ).trim()

  const ccBase = (agentJson.conversation_config && typeof agentJson.conversation_config === 'object'
    ? agentJson.conversation_config
    : {}) as Record<string, unknown>
  const cc = cloneJson(ccBase) as Record<string, unknown>
  if (typeof speechSpeed === 'number' && Number.isFinite(speechSpeed)) {
    const clamped = Math.min(1.5, Math.max(0.5, Math.round(speechSpeed * 100) / 100))
    const prevTts =
      cc.tts && typeof cc.tts === 'object' && !Array.isArray(cc.tts)
        ? { ...(cc.tts as Record<string, unknown>) }
        : {}
    cc.tts = { ...prevTts, speed: clamped }
  }

  const ag = (cc.agent && typeof cc.agent === 'object' ? cc.agent : {}) as Record<string, unknown>
  const pr = (ag.prompt && typeof ag.prompt === 'object' ? ag.prompt : {}) as Record<string, unknown>

  const mergedPrompt = sanitizePromptForPatch(pr, nextPrompt)
  if (wantLiveTool && followUpToolId) {
    const prev = Array.isArray(mergedPrompt.tool_ids)
      ? ([...mergedPrompt.tool_ids] as string[]).filter((x) => typeof x === 'string')
      : []
    if (!prev.includes(followUpToolId)) prev.push(followUpToolId)
    mergedPrompt.tool_ids = prev
  } else if (!wantLiveTool && knownToolId && Array.isArray(mergedPrompt.tool_ids)) {
    mergedPrompt.tool_ids = (mergedPrompt.tool_ids as string[]).filter((id) => id !== knownToolId)
  }

  cc.agent = {
    ...ag,
    prompt: mergedPrompt,
  }

  const patchBody = { conversation_config: cc }

  const patchUrl = `${baseUrl}?enable_versioning_if_not_enabled=true`
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  })

  if (!patchRes.ok) {
    const t = await patchRes.text()
    return { ok: false, error: `PATCH agent ${patchRes.status}: ${t.slice(0, 800)}` }
  }

  return { ok: true }
}
