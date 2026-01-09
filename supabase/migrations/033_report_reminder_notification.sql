-- Migration 033: Report reminder notifications
--
-- Add new notification type for report reminders

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'report_reminder' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'report_reminder';
  END IF;
END;
$$;

