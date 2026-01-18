/**
 * Utility functions for converting between database types and app types
 */

import {
  Patient,
  Call,
  ProactiveSequence,
  CallbackTask,
  CallbackAttempt,
  ScheduledCheckIn,
  ActivityEvent,
  AgentConfig,
  SequenceStep,
  AdoptionSignals,
} from '@/lib/types'
import {
  PatientRow,
  CallRow,
  ProactiveSequenceRow,
  CallbackTaskRow,
  CallbackAttemptRow,
  ScheduledCheckInRow,
  ActivityEventRow,
  AgentConfigRow,
} from './types'

// Convert database row to app type
export function dbPatientToApp(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    tags: row.tags as Patient['tags'],
    riskScore: row.risk_score,
    riskReasons: row.risk_reasons,
    lastContactAt: row.last_contact_at ? new Date(row.last_contact_at) : new Date(),
    adoptionSignals: (row.adoption_signals as unknown as AdoptionSignals) || {
      woreToday: null,
      estimatedHoursWorn: null,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: row.proactive_check_ins_enabled,
    selectedSequenceIds: row.selected_sequence_ids || undefined,
    deviceBrand: row.device_brand || undefined,
    deviceModel: row.device_model || undefined,
    fittingDate: row.fitting_date ? new Date(row.fitting_date) : undefined,
  }
}

export function appPatientToDb(patient: Patient, userId: string): Omit<PatientRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: patient.name,
    phone: patient.phone,
    email: patient.email,
    tags: patient.tags,
    risk_score: patient.riskScore,
    risk_reasons: patient.riskReasons,
    last_contact_at: patient.lastContactAt.toISOString(),
    adoption_signals: patient.adoptionSignals as unknown as Record<string, unknown>,
    proactive_check_ins_enabled: patient.proactiveCheckInsEnabled,
    selected_sequence_ids: patient.selectedSequenceIds || null,
    device_brand: patient.deviceBrand || null,
    device_model: patient.deviceModel || null,
    fitting_date: patient.fittingDate?.toISOString().split('T')[0] || null,
    user_id: userId,
  }
}

export function dbCallToApp(row: CallRow): Call {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    callerName: row.caller_name,
    phone: row.phone,
    patientId: row.patient_id || undefined,
    intent: row.intent as Call['intent'],
    outcome: row.outcome as Call['outcome'],
    status: row.status as Call['status'],
    durationSec: row.duration_sec,
    sentiment: row.sentiment as Call['sentiment'],
    escalated: row.escalated,
    summary: row.summary as unknown as Call['summary'],
    transcript: row.transcript,
    entities: (row.entities as unknown as Call['entities']) || {},
  }
}

export function appCallToDb(call: Call, userId: string): Omit<CallRow, 'created_at'> {
  return {
    id: call.id,
    timestamp: call.timestamp.toISOString(),
    caller_name: call.callerName,
    phone: call.phone,
    patient_id: call.patientId || null,
    intent: call.intent,
    outcome: call.outcome,
    status: call.status,
    duration_sec: call.durationSec,
    sentiment: call.sentiment,
    escalated: call.escalated,
    summary: call.summary as unknown as Record<string, unknown>,
    transcript: call.transcript,
    entities: call.entities as unknown as Record<string, unknown>,
    user_id: userId,
  }
}

export function dbSequenceToApp(row: ProactiveSequenceRow): ProactiveSequence {
  return {
    id: row.id,
    name: row.name,
    audienceTag: row.audience_tag as ProactiveSequence['audienceTag'],
    steps: row.steps as unknown as SequenceStep[],
    active: row.active,
  }
}

export function appSequenceToDb(sequence: ProactiveSequence, userId: string): Omit<ProactiveSequenceRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: sequence.name,
    audience_tag: sequence.audienceTag,
    steps: sequence.steps as unknown as Record<string, unknown>[],
    active: sequence.active,
    user_id: userId,
  }
}

export function dbCallbackTaskToApp(row: CallbackTaskRow, attempts: CallbackAttempt[]): CallbackTask {
  // Derive status from attempts
  const hasAnsweredAttempt = attempts.some(a => a.outcome === 'answered')
  const isExhausted = attempts.length >= row.max_attempts && !hasAnsweredAttempt
  const hasAttempts = attempts.length > 0
  
  let status: CallbackTask['status']
  if (hasAnsweredAttempt) {
    status = 'completed'
  } else if (isExhausted) {
    status = 'max_attempts_reached'
  } else if (hasAttempts) {
    status = 'in_progress'
  } else {
    status = 'pending'
  }
  
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    phone: row.phone,
    callReason: row.call_reason,
    callGoal: row.call_goal,
    priority: row.priority as CallbackTask['priority'],
    status, // Derived from attempts
    createdAt: new Date(row.created_at),
    dueAt: row.due_at ? new Date(row.due_at) : undefined,
    callId: row.call_id || undefined,
    attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : undefined,
    conversationId: row.conversation_id || undefined,
  }
}

export function appCallbackTaskToDb(task: CallbackTask, userId: string): Omit<CallbackTaskRow, 'id' | 'created_at'> {
  return {
    patient_id: task.patientId,
    patient_name: task.patientName,
    phone: task.phone,
    call_reason: task.callReason,
    call_goal: task.callGoal,
    priority: task.priority,
    due_at: task.dueAt?.toISOString() || null,
    call_id: task.callId || null,
    max_attempts: task.maxAttempts,
    next_attempt_at: task.nextAttemptAt?.toISOString() || null,
    conversation_id: task.conversationId || null,
    user_id: userId,
  }
}

export function dbCallbackAttemptToApp(row: CallbackAttemptRow): CallbackAttempt {
  return {
    attemptNumber: row.attempt_number,
    timestamp: new Date(row.timestamp),
    outcome: row.outcome as CallbackAttempt['outcome'],
    notes: row.notes || undefined,
    durationSec: row.duration_sec || undefined,
  }
}

export function appCallbackAttemptToDb(attempt: CallbackAttempt, taskId: string): Omit<CallbackAttemptRow, 'id' | 'created_at'> {
  return {
    task_id: taskId,
    attempt_number: attempt.attemptNumber,
    timestamp: attempt.timestamp.toISOString(),
    outcome: attempt.outcome,
    notes: attempt.notes || null,
    duration_sec: attempt.durationSec || null,
  }
}

export function dbScheduledCheckInToApp(row: ScheduledCheckInRow): ScheduledCheckIn {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    phone: row.phone,
    sequenceId: row.sequence_id,
    sequenceName: row.sequence_name,
    stepDay: row.step_day,
    scheduledFor: new Date(row.scheduled_for),
    channel: row.channel as ScheduledCheckIn['channel'],
    goal: row.goal,
    script: row.script,
    questions: row.questions,
    status: row.status as ScheduledCheckIn['status'],
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    completedCallId: row.completed_call_id || undefined,
    triggeredAt: row.triggered_at ? new Date(row.triggered_at) : undefined,
    conversationId: row.conversation_id || undefined,
  }
}

export function appScheduledCheckInToDb(checkIn: ScheduledCheckIn, userId: string): Omit<ScheduledCheckInRow, 'id'> {
  return {
    patient_id: checkIn.patientId,
    patient_name: checkIn.patientName,
    phone: checkIn.phone,
    sequence_id: checkIn.sequenceId,
    sequence_name: checkIn.sequenceName,
    step_day: checkIn.stepDay,
    scheduled_for: checkIn.scheduledFor.toISOString(),
    channel: checkIn.channel,
    goal: checkIn.goal,
    script: checkIn.script,
    questions: checkIn.questions,
    status: checkIn.status,
    completed_at: checkIn.completedAt?.toISOString() || null,
    completed_call_id: checkIn.completedCallId || null,
    triggered_at: checkIn.triggeredAt?.toISOString() || null,
    conversation_id: checkIn.conversationId || null,
    user_id: userId,
  }
}

export function dbActivityEventToApp(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type as ActivityEvent['type'],
    description: row.description,
    timestamp: new Date(row.timestamp),
    patientName: row.patient_name || undefined,
    patientId: row.patient_id || undefined,
  }
}

export function appActivityEventToDb(event: ActivityEvent, userId: string): Omit<ActivityEventRow, 'id'> {
  return {
    type: event.type,
    description: event.description,
    timestamp: event.timestamp.toISOString(),
    patient_name: event.patientName || null,
    patient_id: event.patientId || null,
    user_id: userId,
  }
}

export function dbAgentConfigToApp(row: AgentConfigRow): AgentConfig {
  return {
    clinicName: row.clinic_name,
    phoneNumber: row.phone_number,
    hoursOpen: row.hours_open,
    hoursClose: row.hours_close,
    voiceStyle: row.voice_style as AgentConfig['voiceStyle'],
    speechSpeed: row.speech_speed,
    elevenLabsAgentId: row.eleven_labs_agent_id || undefined,
    elevenLabsOutboundAgentId: row.eleven_labs_outbound_agent_id || undefined,
    elevenLabsPhoneNumberId: row.eleven_labs_phone_number_id || undefined,
    allowedIntents: row.allowed_intents as unknown as AgentConfig['allowedIntents'],
    escalationRules: row.escalation_rules as unknown as AgentConfig['escalationRules'],
    callbackSettings: row.callback_settings as unknown as AgentConfig['callbackSettings'],
  }
}

export function appAgentConfigToDb(config: AgentConfig, userId: string): Omit<AgentConfigRow, 'id' | 'updated_at'> {
  return {
    user_id: userId,
    clinic_name: config.clinicName,
    phone_number: config.phoneNumber,
    hours_open: config.hoursOpen,
    hours_close: config.hoursClose,
    voice_style: config.voiceStyle,
    speech_speed: config.speechSpeed,
    eleven_labs_agent_id: config.elevenLabsAgentId || null,
    eleven_labs_outbound_agent_id: config.elevenLabsOutboundAgentId || null,
    eleven_labs_phone_number_id: config.elevenLabsPhoneNumberId || null,
    allowed_intents: config.allowedIntents as unknown as Record<string, unknown>,
    escalation_rules: config.escalationRules as unknown as Record<string, unknown>,
    callback_settings: config.callbackSettings as unknown as Record<string, unknown>,
  }
}
