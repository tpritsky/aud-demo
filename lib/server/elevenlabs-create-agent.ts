import type { AgentConfig, ClinicVertical } from '@/lib/types'
import {
  applyAgentClinicFactsPatch,
  mergeCallAiSettings,
  parseClinicSettingsBlob,
} from '@/lib/clinic-call-ai'
import { isPlaceholderOrMissingElevenLabsAgentId } from '@/lib/elevenlabs-placeholders'
import { ensureConvaiInboundLineAssignedToClinicAgent } from '@/lib/server/elevenlabs-assign-phone'
import { resolvePublicPhoneForAgentConfig } from '@/lib/server/elevenlabs-line-phone'
import { syncElevenLabsAgentPrompt } from '@/lib/server/elevenlabs-prompt-sync'

const CREATE_URL = 'https://api.elevenlabs.io/v1/convai/agents/create'

function clampTtsCreateSpeed(raw: number | undefined): number {
  const s = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1
  return Math.min(1.2, Math.max(0.7, Math.round(s * 100) / 100))
}

/**
 * POST /v1/convai/agents/create — minimal ConvAI agent; prompt is filled by `syncElevenLabsAgentPrompt` next.
 */
export async function createElevenLabsConvAiAgent(opts: {
  apiKey: string
  name: string
  voiceId: string
  speechSpeed?: number
  firstMessage?: string
  language?: string
}): Promise<{ ok: true; agentId: string } | { ok: false; error: string }> {
  const {
    apiKey,
    name,
    voiceId,
    speechSpeed,
    firstMessage = '',
    language = 'en',
  } = opts

  const body = {
    name: name.trim().slice(0, 200) || 'Receptionist',
    conversation_config: {
      tts: {
        model_id: 'eleven_flash_v2',
        voice_id: voiceId.trim() || 'cjVigY5qzO86Huf0OWal',
        speed: clampTtsCreateSpeed(speechSpeed),
      },
      agent: {
        language,
        first_message: typeof firstMessage === 'string' ? firstMessage.slice(0, 2000) : '',
        prompt: {
          prompt: ' ',
          llm: 'gemini-2.5-flash',
          temperature: 0,
        },
      },
    },
  }

  const res = await fetch(CREATE_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    return { ok: false, error: `POST create agent ${res.status}: ${t.slice(0, 800)}` }
  }

  const data = (await res.json()) as { agent_id?: string }
  const agentId = typeof data.agent_id === 'string' ? data.agent_id.trim() : ''
  if (!agentId) {
    return { ok: false, error: 'Create agent response missing agent_id' }
  }
  return { ok: true, agentId }
}

export type ElevenLabsOnboardingProvisionResult =
  | { attempted: false }
  | { attempted: true; ok: true; created: boolean; skippedReason?: undefined }
  | { attempted: true; ok: false; error: string; created?: boolean }
  | { attempted: true; ok: false; skippedReason: 'no_api_key' }

/**
 * After clinic `settings` have been merged for PATCH (including onboarding completed),
 * create an ElevenLabs agent if needed, persist `elevenLabsAgentId`, and run prompt sync.
 * Mutates `prevSettings.agentConfig` when a new agent id is written.
 */
export async function provisionElevenLabsOnOnboardingComplete(opts: {
  prevSettings: Record<string, unknown>
  vertical: ClinicVertical
  hasCompleteOnboarding: boolean
}): Promise<ElevenLabsOnboardingProvisionResult> {
  if (!opts.hasCompleteOnboarding) {
    return { attempted: false }
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    return { attempted: true, ok: false, skippedReason: 'no_api_key' }
  }

  const { agentConfig: rawAc, callAi: partialAi } = parseClinicSettingsBlob(opts.prevSettings)
  const ac: AgentConfig = applyAgentClinicFactsPatch(rawAc, {})
  const callAi = mergeCallAiSettings(opts.vertical, partialAi)

  let agentId = ac.elevenLabsAgentId?.trim()
  let created = false

  if (isPlaceholderOrMissingElevenLabsAgentId(agentId)) {
    const voiceId = ac.elevenLabsVoiceId?.trim() || 'cjVigY5qzO86Huf0OWal'
    const clinicLabel = ac.clinicName?.trim() || 'Clinic'
    const createRes = await createElevenLabsConvAiAgent({
      apiKey,
      name: `${clinicLabel} — receptionist`,
      voiceId,
      speechSpeed: ac.speechSpeed,
      firstMessage: `Thanks for calling ${clinicLabel}. How can I help you today?`,
    })
    if (!createRes.ok) {
      console.error('[ElevenLabs] create agent on onboarding failed:', createRes.error)
      return { attempted: true, ok: false, error: createRes.error }
    }
    agentId = createRes.agentId
    created = true
    opts.prevSettings.agentConfig = {
      ...ac,
      elevenLabsAgentId: agentId,
      elevenLabsOutboundAgentId: ac.elevenLabsOutboundAgentId?.trim() || agentId,
    }
  } else if (agentId) {
    opts.prevSettings.agentConfig = {
      ...ac,
      elevenLabsAgentId: agentId,
      elevenLabsOutboundAgentId: ac.elevenLabsOutboundAgentId?.trim() || agentId,
    }
  }

  const syncRes = await syncElevenLabsAgentPrompt({
    agentId: agentId!,
    apiKey,
    vertical: opts.vertical,
    callAi,
    speechSpeed: ac.speechSpeed,
  })
  if (!syncRes.ok) {
    console.error('[ElevenLabs] prompt sync on onboarding failed:', syncRes.error)
    return { attempted: true, ok: false, error: syncRes.error, created }
  }

  const acLive = opts.prevSettings.agentConfig as AgentConfig
  await ensureConvaiInboundLineAssignedToClinicAgent(apiKey, acLive)
  const withPhone = await resolvePublicPhoneForAgentConfig(apiKey, acLive)
  if (withPhone) opts.prevSettings.agentConfig = withPhone

  return { attempted: true, ok: true, created }
}

/**
 * When clinic settings still have template `defaultAgentConfig` agent IDs, create a real ConvAI agent,
 * sync the prompt, and update `settings.agentConfig` (in-memory). Used during GET/PATCH enrichment so
 * clinics are not stuck on demo IDs after onboarding was skipped or DB was seeded.
 */
export async function provisionAgentIfPlaceholderInSettings(opts: {
  settings: Record<string, unknown>
  vertical: ClinicVertical
  apiKey: string
}): Promise<{ settings: Record<string, unknown>; changed: boolean; error?: string }> {
  const copy: Record<string, unknown> = { ...opts.settings }
  const { agentConfig: rawAc, callAi: partialAi } = parseClinicSettingsBlob(copy)
  if (!rawAc) return { settings: copy, changed: false }

  const ac = applyAgentClinicFactsPatch(rawAc, {}) as AgentConfig
  const inbound = ac.elevenLabsAgentId?.trim()
  if (!isPlaceholderOrMissingElevenLabsAgentId(inbound)) {
    return { settings: copy, changed: false }
  }

  const callAi = mergeCallAiSettings(opts.vertical, partialAi)
  const voiceId = ac.elevenLabsVoiceId?.trim() || 'cjVigY5qzO86Huf0OWal'
  const clinicLabel = ac.clinicName?.trim() || 'Clinic'
  const createRes = await createElevenLabsConvAiAgent({
    apiKey: opts.apiKey,
    name: `${clinicLabel} — receptionist`,
    voiceId,
    speechSpeed: ac.speechSpeed,
    firstMessage: `Thanks for calling ${clinicLabel}. How can I help you today?`,
  })
  if (!createRes.ok) {
    return { settings: copy, changed: false, error: createRes.error }
  }

  const agentId = createRes.agentId
  let nextAc: AgentConfig = {
    ...ac,
    elevenLabsAgentId: agentId,
    elevenLabsOutboundAgentId: agentId,
  }
  copy.agentConfig = nextAc

  const syncRes = await syncElevenLabsAgentPrompt({
    agentId,
    apiKey: opts.apiKey,
    vertical: opts.vertical,
    callAi,
    speechSpeed: ac.speechSpeed,
  })
  if (!syncRes.ok) {
    return { settings: copy, changed: true, error: syncRes.error }
  }

  await ensureConvaiInboundLineAssignedToClinicAgent(opts.apiKey, nextAc)
  const withPhone = await resolvePublicPhoneForAgentConfig(opts.apiKey, nextAc)
  if (withPhone) {
    nextAc = withPhone
    copy.agentConfig = withPhone
  }

  return { settings: copy, changed: true }
}
