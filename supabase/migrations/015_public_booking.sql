-- Migration 015: Public booking requests and slot availability helpers

-- Extend assignment status enum with pending state
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'pending';

-- Enum for public booking request status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_booking_status') THEN
    CREATE TYPE public_booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
  END IF;
END;
$$;

-- Table storing public booking requests coming from unauthenticated users
CREATE TABLE IF NOT EXISTS public_booking_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES student_assignments(id) ON DELETE SET NULL,
  booked_slot_id UUID REFERENCES booked_slots(id) ON DELETE SET NULL,
  request_date DATE NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status public_booking_status NOT NULL DEFAULT 'pending',
  student_first_name TEXT NOT NULL,
  student_last_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time = start_time + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_tutor_id ON public_booking_requests(tutor_id);
CREATE INDEX IF NOT EXISTS idx_public_booking_requests_status ON public_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_public_booking_requests_request_date ON public_booking_requests(request_date);

CREATE TRIGGER trg_public_booking_requests_updated_at
  BEFORE UPDATE ON public_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public_booking_requests ENABLE ROW LEVEL SECURITY;

-- Booking requests visibility
CREATE POLICY "Admins can manage booking requests" ON public_booking_requests
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Tutors can view own booking requests" ON public_booking_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'tutor'
    )
    AND tutor_id = auth.uid()
  );

-- Allow unauthenticated inserts (public booking form)
CREATE POLICY "Anonymous users can create booking requests" ON public_booking_requests
  FOR INSERT WITH CHECK (auth.role() = 'anon');

-- Helper function: check if slot is still available for a specific date
CREATE OR REPLACE FUNCTION is_tutor_slot_available(
  p_tutor_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_weekday INTEGER;
  v_active_template UUID;
BEGIN
  IF p_end <= p_start THEN
    RETURN FALSE;
  END IF;

  SELECT id
    INTO v_active_template
  FROM tutor_availability_templates
  WHERE tutor_id = p_tutor_id
    AND is_active = TRUE
  ORDER BY version DESC
  LIMIT 1;

  IF v_active_template IS NULL THEN
    RETURN FALSE;
  END IF;

  v_weekday := EXTRACT(ISODOW FROM p_date)::INTEGER;

  -- Check slot exists in template and is available
  IF NOT EXISTS (
    SELECT 1
    FROM tutor_availability_slots
    WHERE template_id = v_active_template
      AND day_of_week = v_weekday
      AND is_available = TRUE
      AND start_time = p_start
      AND end_time = p_end
  ) THEN
    RETURN FALSE;
  END IF;

  -- Check for booked slots conflict
  IF EXISTS (
    SELECT 1
    FROM booked_slots
    WHERE tutor_id = p_tutor_id
      AND weekday = v_weekday
      AND status = 'booked'
      AND start_time = p_start
      AND end_time = p_end
  ) THEN
    RETURN FALSE;
  END IF;

  -- Check for other booking requests for the same date/time that are not cancelled
  IF EXISTS (
    SELECT 1
    FROM public_booking_requests
    WHERE tutor_id = p_tutor_id
      AND request_date = p_date
      AND start_time = p_start
      AND end_time = p_end
      AND status != 'cancelled'
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;


