-- Migration 042: Support / audit events for tutor troubleshooting

CREATE TABLE IF NOT EXISTS support_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  actor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  route TEXT,
  correlation_id TEXT NOT NULL,
  request JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  supabase_error JSONB,
  client JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_support_events_created_at ON support_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_events_actor_user_id ON support_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_support_events_correlation_id ON support_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_support_events_severity_error ON support_events(severity)
  WHERE severity IN ('error', 'critical');

ALTER TABLE support_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own support events"
  ON support_events FOR INSERT
  WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY "Users can view own support events"
  ON support_events FOR SELECT
  USING (actor_user_id = auth.uid());

CREATE POLICY "Admins can view all support events"
  ON support_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Inserty z server actions przez service role omijają RLS (createAdminClient).
