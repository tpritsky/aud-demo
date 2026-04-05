import type {
  AgentConfig,
  ClinicCallAiPatch,
  CallLogSavedView,
  ClinicCallAiSettings,
  ClinicVertical,
  KnowledgeDayKey,
  KnowledgeDaySchedule,
  KnowledgeTimeSlot,
  VoiceKnowledgeItem,
  VoiceStyle,
  VoiceTextMessageKind,
  VoiceTextMessageTemplate,
} from '@/lib/types'
import { defaultAgentConfig } from '@/lib/data'
import { DEFAULT_VOICE_CALL_FLOW, expandVoiceCallFlowToGuidance, mergeVoiceCallFlow } from '@/lib/voice-call-flow'
import { formatKnowledgeScheduleHint } from '@/lib/knowledge-schedule'

export const ALLOWED_CLINIC_VERTICALS: ClinicVertical[] = [
  'audiology',
  'ortho',
  'law',
  'general',
  'hospital',
  'rehab',
]

/** Max characters per knowledge card body (sanitized on save; website analysis targets this). */
export const KNOWLEDGE_ITEM_BODY_MAX_CHARS = 16000
/** Max knowledge cards stored per clinic. */
export const KNOWLEDGE_ITEMS_MAX_COUNT = 55
/** Max canned SMS templates per clinic. */
export const TEXT_MESSAGE_TEMPLATES_MAX_COUNT = 40

/** Checkbox keys: what Claude should emphasize in summaries & tags */
export const SUMMARY_FOCUS_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'appointments', label: 'Scheduling & access', hint: 'Wait times, same-day needs, no-shows' },
  { key: 'clinical_risk', label: 'Clinical / safety signals', hint: 'Pain, infection, falls, device failure' },
  { key: 'billing_insurance', label: 'Billing & insurance', hint: 'Claims, copays, prior auth' },
  { key: 'compliance', label: 'Compliance & consent', hint: 'HIPAA, releases, legal intake (law / hospital)' },
  { key: 'equipment', label: 'Devices & equipment', hint: 'Hearing aids, DME, repairs (audiology / rehab)' },
  { key: 'follow_up', label: 'Follow-up & callbacks', hint: 'Who must call back and why' },
  { key: 'sentiment', label: 'Caller sentiment', hint: 'Frustration, confusion, urgency in tone' },
  { key: 'language_barrier', label: 'Language / accessibility', hint: 'Interpreter needs, ADA' },
]

export const DEFAULT_CALL_AI_SETTINGS: ClinicCallAiSettings = {
  summaryFocusKeys: ['appointments', 'follow_up', 'clinical_risk'],
  customSummaryInstructions: '',
  postProcessingRequirements: '',
  inboundPlaybook: '',
  outboundPlaybook: '',
  hangupGuidance: '',
  contextLayers: [],
  knowledgeItems: [],
  textMessageTemplates: [],
  callFlow: { ...DEFAULT_VOICE_CALL_FLOW },
}

const VERTICAL_FOCUS_DEFAULTS: Record<ClinicVertical, string[]> = {
  audiology: ['appointments', 'equipment', 'follow_up', 'clinical_risk', 'sentiment'],
  ortho: ['appointments', 'clinical_risk', 'billing_insurance', 'follow_up'],
  law: ['compliance', 'appointments', 'billing_insurance', 'follow_up', 'sentiment'],
  general: ['appointments', 'follow_up', 'billing_insurance', 'sentiment'],
  hospital: ['clinical_risk', 'compliance', 'appointments', 'follow_up', 'language_barrier'],
  rehab: ['clinical_risk', 'equipment', 'appointments', 'follow_up', 'sentiment'],
}

const VERTICAL_SNIPPETS: Record<ClinicVertical, { triage: string; voice: string }> = {
  audiology: {
    triage: 'This is an audiology / hearing care line. Prioritize hearing aid issues, sound quality, fit, follow-up appointments, and new patient intake.',
    voice: 'Tone: warm, clear, patient. Avoid medical diagnosis; route clinical concerns to the provider.',
  },
  ortho: {
    triage: 'Orthopedic context: pain level, injury timeline, imaging/referrals, post-op concerns, and scheduling.',
    voice: 'Be careful not to give medical advice; escalate red-flag symptoms.',
  },
  law: {
    triage: 'Legal intake context: matter type, urgency, conflicts, deadlines, and retainer/billing questions. Do not give legal advice.',
    voice: 'Neutral, professional; capture facts only; offer callback from attorney when appropriate.',
  },
  general: {
    triage: 'General business line: capture reason for call, urgency, and best callback path.',
    voice: 'Professional and concise.',
  },
  hospital: {
    triage: 'Hospital / health system: prioritize safety, clinical escalation paths, compliance, and care navigation.',
    voice: 'Calm, protocol-aware; never minimize symptoms; use clear handoff language.',
  },
  rehab: {
    triage: 'Rehabilitation: therapy scheduling, equipment, pain or setback reporting, insurance authorization.',
    voice: 'Supportive; encourage adherence; escalate worsening symptoms.',
  },
}

export function normalizeVertical(v: string | null | undefined): ClinicVertical {
  const x = (v || 'general').toLowerCase()
  if (x === 'audiology' || x === 'ortho' || x === 'law' || x === 'general' || x === 'hospital' || x === 'rehab') {
    return x
  }
  return 'general'
}

export function mergeCallAiSettings(
  vertical: ClinicVertical,
  partial?: Partial<ClinicCallAiSettings> | null
): ClinicCallAiSettings {
  const baseKeys = VERTICAL_FOCUS_DEFAULTS[vertical] || VERTICAL_FOCUS_DEFAULTS.general
  const focusKeys =
    partial?.summaryFocusKeys && partial.summaryFocusKeys.length > 0
      ? [...partial.summaryFocusKeys]
      : [...baseKeys]
  const merged: ClinicCallAiSettings = {
    ...DEFAULT_CALL_AI_SETTINGS,
    ...partial,
    summaryFocusKeys: focusKeys,
    contextLayers:
      partial?.contextLayers !== undefined ? partial.contextLayers : DEFAULT_CALL_AI_SETTINGS.contextLayers,
    knowledgeItems:
      partial?.knowledgeItems !== undefined
        ? partial.knowledgeItems
        : DEFAULT_CALL_AI_SETTINGS.knowledgeItems,
    textMessageTemplates:
      partial?.textMessageTemplates !== undefined
        ? partial.textMessageTemplates
        : DEFAULT_CALL_AI_SETTINGS.textMessageTemplates,
    callFlow: mergeVoiceCallFlow(undefined, partial?.callFlow),
  }
  return merged
}

function formatOneKnowledgeCard(k: VoiceKnowledgeItem): string {
  const title = k.title.trim()
  const hint = formatKnowledgeScheduleHint(k)
  const body = k.body.trim()
  if (hint) {
    return `### ${title}\n${hint}\n\n${body}`
  }
  return `### ${title}\n${body}`
}

/** Knowledge cards for prompts: prefers knowledgeItems; falls back to legacy contextLayers. */
export function formatKnowledgeForPrompt(callAi: ClinicCallAiSettings): string {
  const items = (callAi.knowledgeItems || [])
    .filter((k) => k.enabled !== false && k.title?.trim() && k.body?.trim())
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  if (items.length) {
    return items.map((k) => formatOneKnowledgeCard(k)).join('\n\n')
  }
  return (
    (callAi.contextLayers || [])
      .filter((l) => l.title?.trim() && l.body?.trim())
      .map((l) => `### ${l.title.trim()}\n${l.body.trim()}`)
      .join('\n\n') || ''
  )
}

/** Canned SMS lines for managed voice prompt. */
export function formatTextMessageTemplatesForPrompt(callAi: ClinicCallAiSettings): string {
  const items = (callAi.textMessageTemplates || [])
    .filter((t) => t.enabled !== false && t.label?.trim() && t.message?.trim())
    .map((t) => ({ ...t, label: t.label.trim(), message: t.message.trim() }))
  if (!items.length) return ''
  return items
    .map((t) => {
      const role = t.kind === 'scheduling_link' ? 'Scheduling link SMS' : 'SMS'
      const when = t.instructions?.trim() || 'When the caller asks for this information.'
      return `### ${role}: ${t.label}\n**Message:** ${t.message}\n**When to send:** ${when}`
    })
    .join('\n\n')
}

const DAY_KEYS: KnowledgeDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function parseHHMM(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return null
  return t
}

function sanitizeTimeSlots(raw: unknown): KnowledgeTimeSlot[] {
  if (!Array.isArray(raw)) return []
  const out: KnowledgeTimeSlot[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const s = row as Record<string, unknown>
    const start = parseHHMM(s.start)
    const end = parseHHMM(s.end)
    if (!start || !end) continue
    out.push({ start, end })
    if (out.length >= 6) break
  }
  return out
}

function sanitizeDaySchedule(raw: unknown): KnowledgeDaySchedule | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const enabled = typeof s.enabled === 'boolean' ? s.enabled : true
  const slots = sanitizeTimeSlots(s.slots)
  return { enabled, slots: slots.length ? slots : [{ start: '00:00', end: '23:59' }] }
}

function sanitizeKnowledgeSchedule(raw: unknown): Partial<Record<KnowledgeDayKey, KnowledgeDaySchedule>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: Partial<Record<KnowledgeDayKey, KnowledgeDaySchedule>> = {}
  for (const k of DAY_KEYS) {
    if (o[k] === undefined) continue
    const d = sanitizeDaySchedule(o[k])
    if (d) out[k] = d
  }
  return Object.keys(out).length ? out : undefined
}

function sanitizeKnowledgeItems(raw: unknown): VoiceKnowledgeItem[] {
  if (!Array.isArray(raw)) return []
  const out: VoiceKnowledgeItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i]
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.body !== 'string') continue
    const tz =
      typeof o.knowledgeTimezone === 'string' && o.knowledgeTimezone.trim().length < 120
        ? o.knowledgeTimezone.trim()
        : undefined
    const item: VoiceKnowledgeItem = {
      id: o.id.slice(0, 80),
      title: o.title.slice(0, 200),
      body: o.body.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS),
      enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
      sortOrder: typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : i,
    }
    if (typeof o.restrictByTime === 'boolean') item.restrictByTime = o.restrictByTime
    if (tz) item.knowledgeTimezone = tz
    const sched = sanitizeKnowledgeSchedule(o.knowledgeSchedule)
    if (sched) item.knowledgeSchedule = sched
    out.push(item)
    if (out.length >= KNOWLEDGE_ITEMS_MAX_COUNT) break
  }
  return out
}

function sanitizeTextMessageTemplates(raw: unknown): VoiceTextMessageTemplate[] {
  if (!Array.isArray(raw)) return []
  const kinds = ['sms', 'scheduling_link'] as const
  const out: VoiceTextMessageTemplate[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string') continue
    const kind =
      typeof o.kind === 'string' && (kinds as readonly string[]).includes(o.kind)
        ? (o.kind as VoiceTextMessageKind)
        : 'sms'
    const label = typeof o.label === 'string' ? o.label.slice(0, 200) : ''
    const message = typeof o.message === 'string' ? o.message.slice(0, 2000) : ''
    const instructions = typeof o.instructions === 'string' ? o.instructions.slice(0, 2000) : ''
    out.push({
      id: o.id.slice(0, 80),
      kind,
      label,
      message,
      instructions,
      enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    })
    if (out.length >= TEXT_MESSAGE_TEMPLATES_MAX_COUNT) break
  }
  return out
}

function sanitizeCallFlowPatch(raw: unknown): Partial<ClinicCallAiSettings['callFlow']> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const q = ['light', 'balanced', 'thorough'] as const
  const t = ['offer_transfer', 'callback_first', 'let_caller_choose'] as const
  const tx = ['confirm_only', 'send_summary', 'minimal'] as const
  const s = ['collect_times', 'book_specific', 'staff_followup'] as const
  const n = ['urgent_only', 'standard', 'quiet'] as const
  const pick = <const A extends readonly string[]>(v: unknown, allowed: A, fb: A[number]) =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as A[number]) : fb
  const out: Partial<ClinicCallAiSettings['callFlow']> = {}
  if (o.questionStyle !== undefined) out.questionStyle = pick(o.questionStyle, q, 'balanced')
  if (o.transferStyle !== undefined) out.transferStyle = pick(o.transferStyle, t, 'let_caller_choose')
  if (o.textStyle !== undefined) out.textStyle = pick(o.textStyle, tx, 'confirm_only')
  if (o.schedulingStyle !== undefined) out.schedulingStyle = pick(o.schedulingStyle, s, 'collect_times')
  if (o.notificationStyle !== undefined) out.notificationStyle = pick(o.notificationStyle, n, 'standard')
  if (typeof o.questionNotes === 'string') out.questionNotes = o.questionNotes.slice(0, 4000)
  if (typeof o.transferNotes === 'string') out.transferNotes = o.transferNotes.slice(0, 4000)
  if (typeof o.textNotes === 'string') out.textNotes = o.textNotes.slice(0, 4000)
  if (typeof o.schedulingNotes === 'string') out.schedulingNotes = o.schedulingNotes.slice(0, 4000)
  if (typeof o.notificationNotes === 'string') out.notificationNotes = o.notificationNotes.slice(0, 4000)
  return out
}

/** Shared PATCH sanitization for clinic callAi updates (clinic settings + super-admin user-clinic). */
export function sanitizeCallAiIncomingPatch(
  incoming: Partial<ClinicCallAiSettings>
): ClinicCallAiPatch {
  const sanitized: ClinicCallAiPatch = {}
  if (Array.isArray(incoming.summaryFocusKeys)) {
    sanitized.summaryFocusKeys = incoming.summaryFocusKeys.filter((k): k is string => typeof k === 'string')
  }
  if (typeof incoming.customSummaryInstructions === 'string') {
    sanitized.customSummaryInstructions = incoming.customSummaryInstructions.slice(0, 8000)
  }
  if (typeof incoming.postProcessingRequirements === 'string') {
    sanitized.postProcessingRequirements = incoming.postProcessingRequirements.slice(0, 8000)
  }
  if (typeof incoming.inboundPlaybook === 'string') sanitized.inboundPlaybook = incoming.inboundPlaybook.slice(0, 16000)
  if (typeof incoming.outboundPlaybook === 'string') sanitized.outboundPlaybook = incoming.outboundPlaybook.slice(0, 16000)
  if (typeof incoming.hangupGuidance === 'string') sanitized.hangupGuidance = incoming.hangupGuidance.slice(0, 4000)
  if (Array.isArray(incoming.contextLayers)) {
    sanitized.contextLayers = incoming.contextLayers
      .filter(
        (x): x is { id: string; title: string; body: string } =>
          x &&
          typeof x === 'object' &&
          typeof (x as { id?: string }).id === 'string' &&
          typeof (x as { title?: string }).title === 'string' &&
          typeof (x as { body?: string }).body === 'string'
      )
      .map((x) => ({
        id: x.id,
        title: x.title.slice(0, 200),
        body: x.body.slice(0, 8000),
      }))
  }
  if (Array.isArray(incoming.knowledgeItems)) {
    sanitized.knowledgeItems = sanitizeKnowledgeItems(incoming.knowledgeItems)
  }
  if (Array.isArray(incoming.textMessageTemplates)) {
    sanitized.textMessageTemplates = sanitizeTextMessageTemplates(incoming.textMessageTemplates)
  }
  if (incoming.callFlow !== undefined && typeof incoming.callFlow === 'object') {
    const p = sanitizeCallFlowPatch(incoming.callFlow)
    if (Object.keys(p).length) sanitized.callFlow = p
  }
  return sanitized
}

export function parseClinicSettingsBlob(raw: unknown): {
  agentConfig?: AgentConfig
  callAi?: Partial<ClinicCallAiSettings>
  callLogSavedViews?: CallLogSavedView[]
} {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const agentConfig = o.agentConfig as AgentConfig | undefined
  const callAi = o.callAi as Partial<ClinicCallAiSettings> | undefined
  const rawViews = o.callLogSavedViews
  const callLogSavedViews = Array.isArray(rawViews)
    ? rawViews
        .filter(
          (v): v is CallLogSavedView =>
            v != null &&
            typeof v === 'object' &&
            typeof (v as CallLogSavedView).id === 'string' &&
            typeof (v as CallLogSavedView).name === 'string' &&
            typeof (v as CallLogSavedView).filters === 'object'
        )
        .slice(0, 30)
    : undefined
  return { agentConfig, callAi, callLogSavedViews }
}

/** Merge display/business facts into clinic `settings.agentConfig` (hours, public phone, display name). */
export function applyAgentClinicFactsPatch(
  existing: AgentConfig | null | undefined,
  patch: unknown
): AgentConfig {
  const base: AgentConfig = {
    ...defaultAgentConfig,
    ...(existing || {}),
  }
  if (!patch || typeof patch !== 'object') return base
  const o = patch as Record<string, unknown>
  if (typeof o.clinicName === 'string') base.clinicName = o.clinicName.slice(0, 200)
  if (typeof o.phoneNumber === 'string') base.phoneNumber = o.phoneNumber.slice(0, 80)
  for (const key of ['hoursOpen', 'hoursClose'] as const) {
    if (typeof o[key] !== 'string') continue
    const v = o[key].trim().slice(0, 8)
    if (/^\d{2}:\d{2}$/.test(v)) base[key] = v
  }
  return base
}

/** Merge voice / speed from onboarding or settings UI (sanitized). */
export function applyAgentUiPatch(existing: AgentConfig | null | undefined, patch: unknown): AgentConfig {
  const base = applyAgentClinicFactsPatch(existing, {})
  if (!patch || typeof patch !== 'object') return base
  const o = patch as Record<string, unknown>
  const vs = o.voiceStyle
  if (vs === 'calm' || vs === 'neutral' || vs === 'upbeat') base.voiceStyle = vs as VoiceStyle
  if (typeof o.speechSpeed === 'number' && Number.isFinite(o.speechSpeed)) {
    const s = Math.min(1.5, Math.max(0.5, o.speechSpeed))
    base.speechSpeed = Math.round(s * 100) / 100
  }
  if ('elevenLabsVoiceId' in o) {
    const raw = o.elevenLabsVoiceId
    if (raw === null || raw === '') {
      delete base.elevenLabsVoiceId
    } else if (typeof raw === 'string') {
      const t = raw.trim().slice(0, 80)
      if (t) base.elevenLabsVoiceId = t
      else delete base.elevenLabsVoiceId
    }
  }
  if ('elevenLabsPhoneNumberId' in o) {
    const raw = o.elevenLabsPhoneNumberId
    if (raw === null || raw === '') {
      delete base.elevenLabsPhoneNumberId
    } else if (typeof raw === 'string') {
      const t = raw.trim().slice(0, 160)
      if (t) base.elevenLabsPhoneNumberId = t
      else delete base.elevenLabsPhoneNumberId
    }
  }
  return base
}

export function clinicOnboardingIncomplete(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  const o = (settings as Record<string, unknown>).onboarding
  if (!o || typeof o !== 'object') return false
  return (o as Record<string, unknown>).completed !== true
}

export function sanitizeCallLogSavedViews(views: unknown): CallLogSavedView[] {
  if (!Array.isArray(views)) return []
  const out: CallLogSavedView[] = []
  for (const v of views) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string') continue
    const f = o.filters
    if (!f || typeof f !== 'object') continue
    const fl = f as Record<string, unknown>
    out.push({
      id: o.id.slice(0, 80),
      name: o.name.trim().slice(0, 120),
      filters: {
        intent: typeof fl.intent === 'string' ? fl.intent : 'all',
        outcome: typeof fl.outcome === 'string' ? fl.outcome : 'all',
        escalated: typeof fl.escalated === 'string' ? fl.escalated : 'all',
        direction: typeof fl.direction === 'string' ? fl.direction : 'all',
        minUrgency: typeof fl.minUrgency === 'string' ? fl.minUrgency : 'all',
        search: typeof fl.search === 'string' ? fl.search.slice(0, 500) : '',
      },
    })
    if (out.length >= 25) break
  }
  return out
}

/** Extra system context appended for Claude post-call analysis */
export function buildClaudeCallContext(opts: {
  clinicName?: string
  vertical: ClinicVertical
  callAi: ClinicCallAiSettings
}): string {
  const snip = VERTICAL_SNIPPETS[opts.vertical] || VERTICAL_SNIPPETS.general
  const focusLabels = SUMMARY_FOCUS_OPTIONS.filter((o) => opts.callAi.summaryFocusKeys.includes(o.key))
  const parts: string[] = []
  parts.push(`Industry preset (${opts.vertical}): ${snip.triage}`)
  if (focusLabels.length) {
    parts.push(
      'Staff asked the AI summary to emphasize: ' +
        focusLabels.map((f) => `${f.label} — ${f.hint}`).join(' | ')
    )
  }
  if (opts.clinicName) parts.push(`Business name: ${opts.clinicName}`)
  if (opts.callAi.customSummaryInstructions?.trim()) {
    parts.push('Additional instructions from the clinic:\n' + opts.callAi.customSummaryInstructions.trim())
  }
  if (opts.callAi.postProcessingRequirements?.trim()) {
    parts.push(
      'Post-processing requirements (transcript analysis only — not for live agent behavior):\n' +
        opts.callAi.postProcessingRequirements.trim().slice(0, 6000)
    )
  }
  if (opts.callAi.inboundPlaybook?.trim()) {
    parts.push('Inbound call handling notes (for triage context):\n' + opts.callAi.inboundPlaybook.trim().slice(0, 4000))
  }
  if (opts.callAi.outboundPlaybook?.trim()) {
    parts.push('Outbound call context (if this was a callback / outbound):\n' + opts.callAi.outboundPlaybook.trim().slice(0, 4000))
  }
  const knowledgeMd = formatKnowledgeForPrompt(opts.callAi)
  if (knowledgeMd) {
    parts.push('Knowledge for this business:\n' + knowledgeMd.slice(0, 56000))
  }
  const flow = expandVoiceCallFlowToGuidance(opts.callAi.callFlow)
  if (flow) {
    parts.push('How calls should be handled (staff preferences):\n' + flow.slice(0, 6000))
  }
  return parts.join('\n\n')
}

/** Short strings for ElevenLabs dynamic variables (outbound / convai) */
export function buildVoiceDynamicVariables(opts: {
  vertical: ClinicVertical
  callAi: ClinicCallAiSettings
  clinicName?: string
}): Record<string, string> {
  const snip = VERTICAL_SNIPPETS[opts.vertical] || VERTICAL_SNIPPETS.general
  const knowledge = formatKnowledgeForPrompt(opts.callAi)
  const flow = expandVoiceCallFlowToGuidance(opts.callAi.callFlow)
  const staffContext = [
    opts.clinicName && `Clinic: ${opts.clinicName}`,
    `Vertical: ${opts.vertical}`,
    snip.voice,
    snip.triage,
    opts.callAi.outboundPlaybook?.trim(),
    opts.callAi.inboundPlaybook?.trim(),
    knowledge && `Knowledge:\n${knowledge}`,
    flow && `Caller handling:\n${flow}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const hangup = opts.callAi.hangupGuidance?.trim() || snip.voice

  return {
    clinic_vertical: opts.vertical,
    staff_context: staffContext.slice(0, 2500),
    hangup_guidance: hangup.slice(0, 1200),
  }
}
