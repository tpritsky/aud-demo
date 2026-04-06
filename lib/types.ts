export type Sentiment = 'positive' | 'neutral' | 'negative'
export type CallIntent = 'scheduling' | 'reschedule' | 'cancel' | 'new_patient' | 'device_troubleshooting' | 'billing' | 'general_inquiry'
export type CallOutcome = 'resolved' | 'escalated' | 'callback_scheduled' | 'voicemail' | 'no_answer' | 'transferred'
export type CallStatus = 'new' | 'in_progress' | 'pending_callback' | 'resolved' | 'escalated'
export type PatientTag = 'New Fit' | 'Existing' | 'High Risk'
export type Channel = 'call' | 'sms'
export type VoiceStyle = 'calm' | 'neutral' | 'upbeat'

/** Clinic vertical / business type for UX, AI presets, and voice context */
export type ClinicVertical = 'audiology' | 'ortho' | 'law' | 'general' | 'hospital' | 'rehab'

/** Admin-configurable call AI + voice hints (stored in clinics.settings.callAi) */
export interface CallContextLayer {
  id: string
  title: string
  body: string
}

/** Weekday keys for per-day knowledge schedules (Mon-first UI order maps here). */
export type KnowledgeDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface KnowledgeTimeSlot {
  /** Local time in 24h `HH:mm` */
  start: string
  end: string
}

export interface KnowledgeDaySchedule {
  enabled: boolean
  slots: KnowledgeTimeSlot[]
}

/** One card of facts for the voice line (hours, services, FAQs, etc.) */
export interface VoiceKnowledgeItem {
  id: string
  title: string
  body: string
  enabled: boolean
  sortOrder: number
  /** When true, the agent should only rely on this card inside the schedule below. */
  restrictByTime?: boolean
  /** IANA timezone for the schedule (e.g. America/New_York). */
  knowledgeTimezone?: string
  /** Per-day windows; omitted days are treated as off when restrictByTime is true. */
  knowledgeSchedule?: Partial<Record<KnowledgeDayKey, KnowledgeDaySchedule>>
}

/**
 * Preset + notes for how the phone receptionist should behave (rolled into voice + managed prompt).
 * Wording is user-facing in Settings — no vendor product names.
 */
export interface VoiceCallFlowSettings {
  questionStyle: 'light' | 'balanced' | 'thorough'
  questionNotes: string
  transferStyle: 'offer_transfer' | 'callback_first' | 'let_caller_choose'
  transferNotes: string
  textStyle: 'confirm_only' | 'send_summary' | 'minimal'
  textNotes: string
  schedulingStyle: 'collect_times' | 'book_specific' | 'staff_followup'
  schedulingNotes: string
  notificationStyle: 'urgent_only' | 'standard' | 'quiet'
  notificationNotes: string
  /**
   * When true (default), read phone numbers and email addresses back to the caller and ask for correction
   * before sending a text or scheduling delivery.
   */
  confirmContactReadback: boolean
}

/** Preset SMS / scheduling texts the receptionist can send to callers (stored in callAi). */
export type VoiceTextMessageKind = 'sms' | 'scheduling_link'

/** How a template may be delivered when triggered after a call (post-processing). Omitted = SMS-only (legacy). */
export type VoiceTextDeliveryChannels = 'sms' | 'email' | 'both'

export interface VoiceTextMessageTemplate {
  id: string
  kind: VoiceTextMessageKind
  /** Short label, e.g. "Pricing Info" */
  label: string
  /** Message body sent by SMS and/or email (include scheduling URL for scheduling_link). */
  message: string
  /** When the agent should offer or send this text. */
  instructions: string
  enabled: boolean
  /** Post-call delivery channels; defaults to SMS when omitted. */
  deliveryChannels?: VoiceTextDeliveryChannels
}

/** PATCH body fragment; callFlow may be a partial update merged server-side. */
export type ClinicCallAiPatch = Omit<Partial<ClinicCallAiSettings>, 'callFlow'> & {
  callFlow?: Partial<VoiceCallFlowSettings>
}

export interface ClinicCallAiSettings {
  /** Keys from SUMMARY_FOCUS_OPTIONS */
  summaryFocusKeys: string[]
  /** Free-form hints for Claude when summarizing the transcript (tags, urgency, phrasing). */
  customSummaryInstructions: string
  /**
   * Claude post-processing only: must-capture facts, tag naming rules, urgency calibration, compliance notes.
   * Not sent to the live voice agent.
   */
  postProcessingRequirements: string
  /** Live / voice: how inbound calls should flow and sound (also informs Claude’s understanding of context). */
  inboundPlaybook: string
  /** Live / voice: outbound goals, scripts, constraints (also informs Claude for callback/outbound transcripts). */
  outboundPlaybook: string
  hangupGuidance: string
  contextLayers: CallContextLayer[]
  /** Structured knowledge cards (preferred over raw context layers for new setups). */
  knowledgeItems: VoiceKnowledgeItem[]
  /** Canned SMS templates (pricing links, scheduling URL, etc.). */
  textMessageTemplates: VoiceTextMessageTemplate[]
  /** Selectable presets + editable notes for questions, transfers, SMS, scheduling, notifications. */
  callFlow: VoiceCallFlowSettings
}

export type CallDirection = 'inbound' | 'outbound' | 'unknown'

export type ScheduledOutboundStatus = 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface ScheduledOutboundCall {
  id: string
  clinicId: string
  createdBy: string
  toNumber: string
  scheduledFor: Date
  status: ScheduledOutboundStatus
  callGoal: string
  callReason?: string
  patientId?: string
  extraContext?: string
  conversationId?: string
  errorMessage?: string
  createdAt: Date
  attemptCount?: number
  maxAttempts?: number
  lastAttemptAt?: Date | null
  nextRetryAt?: Date | null
}

/** Persisted call-log filter presets (clinics.settings.callLogSavedViews) */
export interface CallLogSavedView {
  id: string
  name: string
  filters: {
    intent: string
    outcome: string
    escalated: string
    direction: string
    minUrgency: string
    search: string
  }
}

/** Profile role: super_admin (platform), admin (business owner), member (worker) */
export type ProfileRole = 'super_admin' | 'admin' | 'member'

export interface CallEntities {
  name?: string
  phone?: string
  deviceBrand?: string
  deviceModel?: string
  issueType?: string
}

export type CallAiProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export interface Call {
  id: string
  timestamp: Date
  callerName: string
  phone: string
  patientId?: string
  intent: CallIntent
  outcome: CallOutcome
  status: CallStatus
  durationSec: number
  sentiment: Sentiment
  escalated: boolean
  summary: {
    reason: string
    resolution: string
    nextSteps?: string
  }
  transcript: string
  entities: CallEntities
  /** Owning user (legacy); clinic-wide listing uses clinicId + RLS */
  clinicId?: string | null
  /** From ElevenLabs phone_call.direction when present */
  callDirection?: CallDirection
  aiProcessingStatus?: CallAiProcessingStatus
  aiBriefSummary?: string | null
  aiCallerName?: string | null
  aiCallerPhone?: string | null
  aiResponseUrgency?: 1 | 2 | 3 | 4 | null
  aiBusinessValue?: 1 | 2 | 3 | 4 | null
  aiTags?: string[]
  aiProcessedAt?: Date | null
  aiError?: string | null
}

export interface AdoptionSignals {
  woreToday: boolean | null
  estimatedHoursWorn: number | null
  comfortIssues: boolean
  soundClarityIssues: boolean
  bluetoothAppIssues: boolean
}

export interface Patient {
  id: string
  name: string
  phone: string
  email: string
  tags: PatientTag[]
  riskScore: number
  riskReasons: string[]
  lastContactAt: Date
  adoptionSignals: AdoptionSignals
  proactiveCheckInsEnabled: boolean
  selectedSequenceIds?: string[] // IDs of sequences to apply to this patient (if set, overrides tag-based matching)
  deviceBrand?: string
  deviceModel?: string
  fittingDate?: Date
}

export interface SequenceStep {
  day: number
  channel: Channel
  goal: string
  script: string
  questions: string[]
  triggers: string[]
}

export interface ProactiveSequence {
  id: string
  name: string
  audienceTag: PatientTag
  steps: SequenceStep[]
  active: boolean
}

export interface ScheduledCheckIn {
  id: string
  patientId: string
  patientName: string
  phone: string
  sequenceId: string
  sequenceName: string
  stepDay: number
  scheduledFor: Date
  channel: Channel
  goal: string
  script: string
  questions: string[]
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'skipped'
  completedAt?: Date
  completedCallId?: string
  triggeredAt?: Date
  conversationId?: string
}

export type CallbackAttemptOutcome = 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'wrong_number'

export interface CallbackAttempt {
  attemptNumber: number
  timestamp: Date
  outcome: CallbackAttemptOutcome
  notes?: string
  durationSec?: number
}

export interface CallbackTask {
  id: string
  patientId: string
  patientName: string
  phone: string
  callReason: string // Specific reason for the call (for AI agent) - required
  callGoal: string // Goal of the call (for AI agent) - required
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'max_attempts_reached'
  createdAt: Date
  dueAt?: Date
  callId?: string
  // Redial tracking
  attempts: CallbackAttempt[]
  maxAttempts: number
  nextAttemptAt?: Date
  conversationId?: string // For matching webhooks from Eleven Labs
}

export interface ActivityEvent {
  id: string
  type: 'call' | 'checkin' | 'escalation' | 'callback' | 'appointment' | 'new_patient'
  description: string
  timestamp: Date
  patientName?: string
  patientId?: string
}

export interface CallbackSettings {
  maxAttempts: number
  redialIntervalMinutes: number
  autoCreateOnEscalation: boolean
  autoCreateOnVoicemail: boolean
  autoCreateOnNoAnswer: boolean
  priorityByDefault: 'high' | 'medium' | 'low'
}

/** ElevenLabs catalog entry for UI pickers (from GET /v1/voices). */
export type ElevenLabsVoiceOption = {
  voiceId: string
  name: string
  previewUrl: string | null
  category: string | null
  gender: string | null
  accent: string | null
}

/** ConvAI phone number row from GET /v1/convai/phone-numbers (normalized for UI). */
export type ElevenLabsPhoneNumberOption = {
  phoneNumberId: string
  /** E.164 or provider format from ElevenLabs */
  phoneNumber: string
  label: string
  provider?: string
  assignedAgentName?: string | null
  /** Inbound ConvAI agent this line is wired to (if any) */
  assignedAgentId?: string | null
}

export interface AgentConfig {
  clinicName: string
  phoneNumber: string
  hoursOpen: string
  hoursClose: string
  voiceStyle: VoiceStyle
  speechSpeed: number
  /** Preferred TTS voice when using ElevenLabs; assign to ConvAI agent in dashboard if needed. */
  elevenLabsVoiceId?: string
  elevenLabsAgentId?: string
  elevenLabsOutboundAgentId?: string
  elevenLabsPhoneNumberId?: string
  allowedIntents: {
    scheduling: boolean
    rescheduleCancel: boolean
    newPatientIntake: boolean
    deviceTroubleshooting: boolean
    billing: boolean
  }
  escalationRules: {
    medicalQuestion: boolean
    upsetSentiment: boolean
    repeatedMisunderstanding: boolean
    userRequestsHuman: boolean
  }
  callbackSettings: CallbackSettings
}

export interface KPIData {
  callsToday: number
  missedCallsPrevented: number
  appointmentsBooked: number
  proactiveCheckInsCompleted: number
  escalationsCreated: number
}
