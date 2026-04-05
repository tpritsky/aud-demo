-- Call direction (ElevenLabs phone_call.direction), clinic verticals, scheduled outbound calls

-- Broader verticals for playbook + AI presets
ALTER TABLE clinics
  DROP CONSTRAINT IF EXISTS clinics_vertical_check;
ALTER TABLE clinics
  ADD CONSTRAINT clinics_vertical_check CHECK (
    vertical IN (
      'audiology',
      'ortho',
      'law',
      'general',
      'hospital',
      'rehab'
    )
  );

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS call_direction TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE calls
  DROP CONSTRAINT IF EXISTS calls_call_direction_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_call_direction_check CHECK (
    call_direction IN ('inbound', 'outbound', 'unknown')
  );

CREATE INDEX IF NOT EXISTS idx_calls_clinic_direction_ts
  ON calls (clinic_id, call_direction, timestamp DESC);

-- Worker/admin-scheduled outbound dials (processed by cron + ElevenLabs)
CREATE TABLE IF NOT EXISTS scheduled_outbound_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_number TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  call_goal TEXT NOT NULL,
  call_reason TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  extra_context TEXT,
  conversation_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_out_clinic_time
  ON scheduled_outbound_calls (clinic_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sched_out_pending
  ON scheduled_outbound_calls (scheduled_for)
  WHERE status = 'scheduled';

ALTER TABLE scheduled_outbound_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view scheduled outbound"
  ON scheduled_outbound_calls FOR SELECT
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
  );

CREATE POLICY "Clinic members can insert scheduled outbound"
  ON scheduled_outbound_calls FOR INSERT
  WITH CHECK (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Clinic members can update scheduled outbound"
  ON scheduled_outbound_calls FOR UPDATE
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
  );

CREATE POLICY "Clinic members can delete scheduled outbound"
  ON scheduled_outbound_calls FOR DELETE
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
  );
