-- Deferred clinic invites: no auth user until invitee completes /accept-invite.

CREATE TABLE pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_pending_invites_email_clinic ON pending_invites(email, clinic_id);
CREATE INDEX idx_pending_invites_expires_at ON pending_invites(expires_at);

ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;
