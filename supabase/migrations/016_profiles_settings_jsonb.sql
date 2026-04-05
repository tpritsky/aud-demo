-- Per-user UI preferences (e.g. personal call log saved views)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
