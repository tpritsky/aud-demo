/**
 * Database row types - these match the Supabase table schemas
 * These types represent the raw database rows before conversion to app types
 */

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: PatientRow
        Insert: PatientInsert
        Update: PatientUpdate
      }
      calls: {
        Row: CallRow
        Insert: CallInsert
        Update: CallUpdate
      }
      proactive_sequences: {
        Row: ProactiveSequenceRow
        Insert: ProactiveSequenceInsert
        Update: ProactiveSequenceUpdate
      }
      callback_tasks: {
        Row: CallbackTaskRow
        Insert: CallbackTaskInsert
        Update: CallbackTaskUpdate
      }
      callback_attempts: {
        Row: CallbackAttemptRow
        Insert: CallbackAttemptInsert
        Update: CallbackAttemptUpdate
      }
      scheduled_check_ins: {
        Row: ScheduledCheckInRow
        Insert: ScheduledCheckInInsert
        Update: ScheduledCheckInUpdate
      }
      activity_events: {
        Row: ActivityEventRow
        Insert: ActivityEventInsert
        Update: ActivityEventUpdate
      }
      agent_config: {
        Row: AgentConfigRow
        Insert: AgentConfigInsert
        Update: AgentConfigUpdate
      }
    }
  }
}

// Patient types
export interface PatientRow {
  id: string
  name: string
  phone: string
  email: string
  tags: string[]
  risk_score: number
  risk_reasons: string[]
  last_contact_at: string | null
  adoption_signals: Record<string, unknown> | null
  proactive_check_ins_enabled: boolean
  selected_sequence_ids: string[] | null
  device_brand: string | null
  device_model: string | null
  fitting_date: string | null
  created_at: string
  updated_at: string
  user_id: string
}

export type PatientInsert = Omit<PatientRow, 'id' | 'created_at' | 'updated_at'>
export type PatientUpdate = Partial<Omit<PatientRow, 'id' | 'created_at' | 'user_id'>>

// Call types
export interface CallRow {
  id: string
  timestamp: string
  caller_name: string
  phone: string
  patient_id: string | null
  intent: string
  outcome: string
  status: string
  duration_sec: number
  sentiment: string
  escalated: boolean
  summary: Record<string, unknown>
  transcript: string
  entities: Record<string, unknown> | null
  created_at: string
  user_id: string
}

export type CallInsert = Omit<CallRow, 'created_at'>
export type CallUpdate = Partial<Omit<CallRow, 'id' | 'created_at' | 'user_id'>>

// Proactive Sequence types
export interface ProactiveSequenceRow {
  id: string
  name: string
  audience_tag: string
  steps: Record<string, unknown>[]
  active: boolean
  created_at: string
  updated_at: string
  user_id: string
}

export type ProactiveSequenceInsert = Omit<ProactiveSequenceRow, 'id' | 'created_at' | 'updated_at'>
export type ProactiveSequenceUpdate = Partial<Omit<ProactiveSequenceRow, 'id' | 'created_at' | 'user_id'>>

// Callback Task types
export interface CallbackTaskRow {
  id: string
  patient_id: string
  patient_name: string
  phone: string
  call_reason: string
  call_goal: string
  priority: string
  created_at: string
  due_at: string | null
  call_id: string | null
  max_attempts: number
  next_attempt_at: string | null
  conversation_id: string | null
  user_id: string
}

export type CallbackTaskInsert = Omit<CallbackTaskRow, 'id' | 'created_at'>
export type CallbackTaskUpdate = Partial<Omit<CallbackTaskRow, 'id' | 'created_at' | 'user_id'>>

// Callback Attempt types
export interface CallbackAttemptRow {
  id: string
  task_id: string
  attempt_number: number
  timestamp: string
  outcome: string
  notes: string | null
  duration_sec: number | null
  created_at: string
}

export type CallbackAttemptInsert = Omit<CallbackAttemptRow, 'id' | 'created_at'>
export type CallbackAttemptUpdate = Partial<Omit<CallbackAttemptRow, 'id' | 'created_at'>>

// Scheduled Check-in types
export interface ScheduledCheckInRow {
  id: string
  patient_id: string
  patient_name: string
  phone: string
  sequence_id: string
  sequence_name: string
  step_day: number
  scheduled_for: string
  channel: string
  goal: string
  script: string
  questions: string[]
  status: string
  completed_at: string | null
  completed_call_id: string | null
  triggered_at: string | null
  conversation_id: string | null
  user_id: string
}

export type ScheduledCheckInInsert = Omit<ScheduledCheckInRow, 'id'>
export type ScheduledCheckInUpdate = Partial<Omit<ScheduledCheckInRow, 'id' | 'user_id'>>

// Activity Event types
export interface ActivityEventRow {
  id: string
  type: string
  description: string
  timestamp: string
  patient_name: string | null
  patient_id: string | null
  user_id: string
}

export type ActivityEventInsert = Omit<ActivityEventRow, 'id'>
export type ActivityEventUpdate = Partial<Omit<ActivityEventRow, 'id' | 'user_id'>>

// Agent Config types
export interface AgentConfigRow {
  id: string
  user_id: string
  clinic_name: string
  phone_number: string
  hours_open: string
  hours_close: string
  voice_style: string
  speech_speed: number
  eleven_labs_agent_id: string | null
  eleven_labs_outbound_agent_id: string | null
  eleven_labs_phone_number_id: string | null
  allowed_intents: Record<string, unknown>
  escalation_rules: Record<string, unknown>
  callback_settings: Record<string, unknown>
  updated_at: string
}

export type AgentConfigInsert = Omit<AgentConfigRow, 'id' | 'updated_at'>
export type AgentConfigUpdate = Partial<Omit<AgentConfigRow, 'id' | 'user_id' | 'updated_at'>>
