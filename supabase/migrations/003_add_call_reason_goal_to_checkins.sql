-- Add call_reason and call_goal columns to scheduled_check_ins table
-- These fields are used to pass dynamic variables to the Eleven Labs agent

ALTER TABLE scheduled_check_ins
  ADD COLUMN IF NOT EXISTS call_reason TEXT,
  ADD COLUMN IF NOT EXISTS call_goal TEXT;

-- Update existing rows to use goal as fallback for call_reason and call_goal
UPDATE scheduled_check_ins
SET 
  call_reason = COALESCE(call_reason, goal),
  call_goal = COALESCE(call_goal, goal)
WHERE call_reason IS NULL OR call_goal IS NULL;
