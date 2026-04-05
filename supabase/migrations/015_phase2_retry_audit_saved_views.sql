-- Scheduled outbound: retries + audit trail

ALTER TABLE scheduled_outbound_calls
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE scheduled_outbound_calls
  DROP CONSTRAINT IF EXISTS scheduled_outbound_calls_max_attempts_check;
ALTER TABLE scheduled_outbound_calls
  ADD CONSTRAINT scheduled_outbound_calls_max_attempts_check
    CHECK (max_attempts >= 1 AND max_attempts <= 10);

CREATE INDEX IF NOT EXISTS idx_sched_out_due
  ON scheduled_outbound_calls (status, scheduled_for, next_retry_at);

CREATE TABLE IF NOT EXISTS scheduled_outbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_outbound_id UUID NOT NULL REFERENCES scheduled_outbound_calls(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'dial_attempt',
      'dial_success',
      'dial_failed',
      'retry_scheduled',
      'cancelled',
      'skipped_max_attempts'
    )
  ),
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_out_events_row
  ON scheduled_outbound_events (scheduled_outbound_id, created_at DESC);

ALTER TABLE scheduled_outbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view scheduled outbound events"
  ON scheduled_outbound_events FOR SELECT
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
  );
