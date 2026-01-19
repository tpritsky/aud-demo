-- Add triggers column to scheduled_check_ins table
-- This stores escalation triggers from the sequence step

ALTER TABLE scheduled_check_ins
  ADD COLUMN IF NOT EXISTS triggers TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing rows to have empty triggers array if null
UPDATE scheduled_check_ins
SET triggers = ARRAY[]::TEXT[]
WHERE triggers IS NULL;
