-- Migration 020: Session confirmation notifications

-- Add new notification type for session confirmation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'session_confirmation_required' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'session_confirmation_required';
  END IF;
END;
$$;

-- Function to create notifications for sessions that need confirmation
-- This function finds sessions that:
-- 1. Have status = 'scheduled'
-- 2. Have session_date in the past
-- 3. Don't have a notification already created for them
CREATE OR REPLACE FUNCTION create_session_confirmation_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_notification_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Find sessions that need confirmation
  FOR v_session IN
    SELECT 
      ts.id,
      ts.tutor_id,
      ts.session_date,
      ts.duration_minutes,
      s.first_name || ' ' || s.last_name AS student_name,
      sub.name AS subject_name
    FROM tutoring_sessions ts
    INNER JOIN students s ON ts.student_id = s.id
    INNER JOIN student_assignments sa ON ts.assignment_id = sa.id
    INNER JOIN subjects sub ON sa.subject_id = sub.id
    WHERE ts.status = 'scheduled'
      AND ts.session_date < NOW()
      AND NOT EXISTS (
        SELECT 1 
        FROM notifications n
        WHERE n.user_id = ts.tutor_id
          AND n.type = 'session_confirmation_required'
          AND (n.metadata->>'session_id')::UUID = ts.id
      )
  LOOP
    -- Create notification for tutor
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_session.tutor_id,
      'session_confirmation_required',
      'Potwierdź odbycie lekcji',
      'Lekcja z ' || v_session.student_name || ' (' || v_session.subject_name || ') z dnia ' || 
      TO_CHAR(v_session.session_date, 'DD.MM.YYYY HH24:MI') || ' wymaga potwierdzenia.',
      jsonb_build_object(
        'session_id', v_session.id,
        'session_date', v_session.session_date,
        'student_name', v_session.student_name,
        'subject_name', v_session.subject_name
      )
    )
    RETURNING id INTO v_notification_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to check and create notifications (can be called periodically)
-- This can be called by a cron job or on page load
CREATE OR REPLACE FUNCTION check_and_notify_pending_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN create_session_confirmation_notifications();
END;
$$;

