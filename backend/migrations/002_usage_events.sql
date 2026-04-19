-- Silent analytics: inserted by the backend service role only.
-- Enable RLS with no policies so the table is not readable/writable via the anon key.

CREATE TABLE IF NOT EXISTS usage_events (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_event_type
  ON usage_events (event_type);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
