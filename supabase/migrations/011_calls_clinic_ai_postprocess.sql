-- Clinic scoping + AI post-processing fields for calls

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_processing_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE calls
  ADD CONSTRAINT calls_ai_processing_status_check
  CHECK (ai_processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_brief_summary TEXT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_caller_name TEXT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_caller_phone TEXT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_response_urgency SMALLINT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_business_value SMALLINT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS ai_error TEXT;

ALTER TABLE calls
  ADD CONSTRAINT calls_ai_urgency_check
  CHECK (ai_response_urgency IS NULL OR (ai_response_urgency >= 1 AND ai_response_urgency <= 4));

ALTER TABLE calls
  ADD CONSTRAINT calls_ai_value_check
  CHECK (ai_business_value IS NULL OR (ai_business_value >= 1 AND ai_business_value <= 4));

CREATE INDEX IF NOT EXISTS idx_calls_clinic_id ON calls(clinic_id);
CREATE INDEX IF NOT EXISTS idx_calls_clinic_timestamp ON calls(clinic_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calls_clinic_urgency ON calls(clinic_id, ai_response_urgency DESC NULLS LAST);

-- Same-clinic members can read calls tied to their business (in addition to own user_id policy)
DROP POLICY IF EXISTS "Clinic members can view clinic calls" ON calls;
CREATE POLICY "Clinic members can view clinic calls" ON calls
  FOR SELECT
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = public.current_user_clinic_id()
  );
