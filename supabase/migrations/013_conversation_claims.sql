-- Link ElevenLabs conversation_id → user who started the call (e.g. Settings "test call").
-- Webhook looks this up first so test calls attach to the right account.

CREATE TABLE conversation_claims (
  conversation_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_claims_user_id ON conversation_claims(user_id);
CREATE INDEX idx_conversation_claims_created_at ON conversation_claims(created_at DESC);

ALTER TABLE conversation_claims ENABLE ROW LEVEL SECURITY;
