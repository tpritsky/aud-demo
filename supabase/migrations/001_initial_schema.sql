-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE patient_tag AS ENUM ('New Fit', 'Existing', 'High Risk');
CREATE TYPE call_intent AS ENUM ('scheduling', 'reschedule', 'cancel', 'new_patient', 'device_troubleshooting', 'billing', 'general_inquiry');
CREATE TYPE call_outcome AS ENUM ('resolved', 'escalated', 'callback_scheduled', 'voicemail', 'no_answer', 'transferred');
CREATE TYPE call_status AS ENUM ('new', 'in_progress', 'pending_callback', 'resolved', 'escalated');
CREATE TYPE sentiment AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE channel AS ENUM ('call', 'sms');
CREATE TYPE voice_style AS ENUM ('calm', 'neutral', 'upbeat');
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE checkin_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'skipped');
CREATE TYPE attempt_outcome AS ENUM ('answered', 'voicemail', 'no_answer', 'busy', 'wrong_number');
CREATE TYPE activity_type AS ENUM ('call', 'checkin', 'escalation', 'callback', 'appointment', 'new_patient');

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_reasons TEXT[] NOT NULL DEFAULT '{}',
  last_contact_at TIMESTAMPTZ,
  adoption_signals JSONB,
  proactive_check_ins_enabled BOOLEAN NOT NULL DEFAULT false,
  selected_sequence_ids UUID[],
  device_brand TEXT,
  device_model TEXT,
  fitting_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on phone for patient matching
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_user_id ON patients(user_id);

-- Calls table
CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  caller_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  intent call_intent NOT NULL,
  outcome call_outcome NOT NULL,
  status call_status NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  sentiment sentiment NOT NULL,
  escalated BOOLEAN NOT NULL DEFAULT false,
  summary JSONB NOT NULL,
  transcript TEXT NOT NULL,
  entities JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_calls_phone ON calls(phone);
CREATE INDEX idx_calls_patient_id ON calls(patient_id);
CREATE INDEX idx_calls_timestamp ON calls(timestamp DESC);
CREATE INDEX idx_calls_user_id ON calls(user_id);

-- Proactive sequences table
CREATE TABLE proactive_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  audience_tag TEXT NOT NULL,
  steps JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_proactive_sequences_user_id ON proactive_sequences(user_id);

-- Callback tasks table
CREATE TABLE callback_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  call_reason TEXT NOT NULL,
  call_goal TEXT NOT NULL,
  priority task_priority NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  conversation_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_callback_tasks_patient_id ON callback_tasks(patient_id);
CREATE INDEX idx_callback_tasks_due_at ON callback_tasks(due_at);
CREATE INDEX idx_callback_tasks_next_attempt_at ON callback_tasks(next_attempt_at);
CREATE INDEX idx_callback_tasks_user_id ON callback_tasks(user_id);

-- Callback attempts table
CREATE TABLE callback_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES callback_tasks(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  outcome attempt_outcome NOT NULL,
  notes TEXT,
  duration_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_callback_attempts_task_id ON callback_attempts(task_id);

-- Scheduled check-ins table
CREATE TABLE scheduled_check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  sequence_id UUID NOT NULL REFERENCES proactive_sequences(id) ON DELETE CASCADE,
  sequence_name TEXT NOT NULL,
  step_day INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  channel channel NOT NULL,
  goal TEXT NOT NULL,
  script TEXT NOT NULL,
  questions TEXT[] NOT NULL,
  status checkin_status NOT NULL DEFAULT 'scheduled',
  completed_at TIMESTAMPTZ,
  completed_call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ,
  conversation_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduled_check_ins_patient_id ON scheduled_check_ins(patient_id);
CREATE INDEX idx_scheduled_check_ins_scheduled_for ON scheduled_check_ins(scheduled_for);
CREATE INDEX idx_scheduled_check_ins_user_id ON scheduled_check_ins(user_id);

-- Activity events table
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type activity_type NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  patient_name TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_events_timestamp ON activity_events(timestamp DESC);
CREATE INDEX idx_activity_events_patient_id ON activity_events(patient_id);
CREATE INDEX idx_activity_events_user_id ON activity_events(user_id);

-- Agent config table (one row per user)
CREATE TABLE agent_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  hours_open TEXT NOT NULL,
  hours_close TEXT NOT NULL,
  voice_style voice_style NOT NULL,
  speech_speed INTEGER NOT NULL,
  eleven_labs_agent_id TEXT,
  eleven_labs_outbound_agent_id TEXT,
  eleven_labs_phone_number_id TEXT,
  allowed_intents JSONB NOT NULL,
  escalation_rules JSONB NOT NULL,
  callback_settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_config_user_id ON agent_config(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proactive_sequences_updated_at BEFORE UPDATE ON proactive_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_config_updated_at BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own patients" ON patients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients" ON patients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients" ON patients
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own calls" ON calls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calls" ON calls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calls" ON calls
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sequences" ON proactive_sequences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sequences" ON proactive_sequences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sequences" ON proactive_sequences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sequences" ON proactive_sequences
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own callback tasks" ON callback_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own callback tasks" ON callback_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own callback tasks" ON callback_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own callback tasks" ON callback_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Callback attempts are accessible through their parent task
CREATE POLICY "Users can view attempts for their tasks" ON callback_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM callback_tasks
      WHERE callback_tasks.id = callback_attempts.task_id
      AND callback_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attempts for their tasks" ON callback_attempts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM callback_tasks
      WHERE callback_tasks.id = callback_attempts.task_id
      AND callback_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update attempts for their tasks" ON callback_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM callback_tasks
      WHERE callback_tasks.id = callback_attempts.task_id
      AND callback_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attempts for their tasks" ON callback_attempts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM callback_tasks
      WHERE callback_tasks.id = callback_attempts.task_id
      AND callback_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own scheduled check-ins" ON scheduled_check_ins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled check-ins" ON scheduled_check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled check-ins" ON scheduled_check_ins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled check-ins" ON scheduled_check_ins
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own activity events" ON activity_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity events" ON activity_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own agent config" ON agent_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent config" ON agent_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent config" ON agent_config
  FOR UPDATE USING (auth.uid() = user_id);
