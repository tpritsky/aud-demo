import type { ClinicCallAiSettings, ClinicVertical } from '@/lib/types'
import { formatKnowledgeForPrompt, formatTextMessageTemplatesForPrompt } from '@/lib/clinic-call-ai'
import { expandVoiceCallFlowToGuidance } from '@/lib/voice-call-flow'

const SYNC_START = '<<<AUD_APP_MANAGED_PROMPT_START>>>'
const SYNC_END = '<<<AUD_APP_MANAGED_PROMPT_END>>>'

export function stripManagedPromptBlock(prompt: string): string {
  const re = new RegExp(
    `[\\r\\n]*${SYNC_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SYNC_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\r\\n]*`,
    'g'
  )
  return prompt.replace(re, '').trim()
}

export function buildManagedPromptBlock(vertical: ClinicVertical, callAi: ClinicCallAiSettings): string {
  const knowledge = formatKnowledgeForPrompt(callAi)
  const flow = expandVoiceCallFlowToGuidance(callAi.callFlow)
  const textTemplates = formatTextMessageTemplatesForPrompt(callAi)
  return [
    '',
    SYNC_START,
    `[Clinic vertical: ${vertical}]`,
    '',
    '## Knowledge',
    knowledge.trim() || '(Add knowledge cards in the app — hours, services, policies.)',
    '',
    '## Canned text messages (SMS)',
    textTemplates.trim() || '(Optional — add templates under Send texts in the app.)',
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
    'Per-call dynamic variables (injected by the app): {{staff_context}}, {{hangup_guidance}}, {{clinic_vertical}}, {{call_goal}}, {{call_reason}}, {{clinic_name}}, {{patient_name}}',
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
  const nextPrompt = (stripped + buildManagedPromptBlock(vertical, callAi)).trim()

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

  cc.agent = {
    ...ag,
    prompt: sanitizePromptForPatch(pr, nextPrompt),
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
