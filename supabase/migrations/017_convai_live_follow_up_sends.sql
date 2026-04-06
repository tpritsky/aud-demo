-- Tracks follow-ups sent during a live ConvAI call (webhook tool) so post-call delivery skips duplicates.
CREATE TABLE IF NOT EXISTS convai_live_follow_up_sends (
  conversation_id text NOT NULL,
  template_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_convai_live_follow_up_sends_sent_at ON convai_live_follow_up_sends (sent_at DESC);

ALTER TABLE convai_live_follow_up_sends ENABLE ROW LEVEL SECURITY;
