-- Migration 019: Add status to tutoring sessions

-- Create enum for session status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
END;
$$;

-- Add status column to tutoring_sessions
ALTER TABLE tutoring_sessions
ADD COLUMN IF NOT EXISTS status session_status NOT NULL DEFAULT 'scheduled';

-- Update existing sessions based on session_date
-- Past sessions → 'completed', future sessions → 'scheduled'
UPDATE tutoring_sessions
SET status = CASE
  WHEN session_date < NOW() THEN 'completed'::session_status
  ELSE 'scheduled'::session_status
END
WHERE status = 'scheduled';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tutoring_sessions_status ON tutoring_sessions(status);

-- Create composite index for common queries (status + date)
CREATE INDEX IF NOT EXISTS idx_tutoring_sessions_status_date ON tutoring_sessions(status, session_date);

