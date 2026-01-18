export type Sentiment = 'positive' | 'neutral' | 'negative'
export type CallIntent = 'scheduling' | 'reschedule' | 'cancel' | 'new_patient' | 'device_troubleshooting' | 'billing' | 'general_inquiry'
export type CallOutcome = 'resolved' | 'escalated' | 'callback_scheduled' | 'voicemail' | 'no_answer' | 'transferred'
export type CallStatus = 'new' | 'in_progress' | 'pending_callback' | 'resolved' | 'escalated'
export type PatientTag = 'New Fit' | 'Existing' | 'High Risk'
export type Channel = 'call' | 'sms'
export type VoiceStyle = 'calm' | 'neutral' | 'upbeat'

export interface CallEntities {
  name?: string
  phone?: string
  deviceBrand?: string
  deviceModel?: string
  issueType?: string
}

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

export interface AgentConfig {
  clinicName: string
  phoneNumber: string
  hoursOpen: string
  hoursClose: string
  voiceStyle: VoiceStyle
  speechSpeed: number
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
