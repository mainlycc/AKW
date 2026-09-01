-- Migration 049: Availability reminder notifications
--
-- Add new notification type for availability reminders

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'availability_reminder'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'availability_reminder';
  END IF;
END;
$$;
