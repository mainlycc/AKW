-- Migration 034: Declaration reminder notifications
--
-- Add new notification type for declaration reminders

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'declaration_reminder'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'declaration_reminder';
  END IF;
END;
$$;

