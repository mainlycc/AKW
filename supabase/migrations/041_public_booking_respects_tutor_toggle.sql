-- Migration 041: Ensure public booking availability respects per-tutor toggle

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
  v_public_booking_enabled BOOLEAN;
BEGIN
  IF p_end <= p_start THEN
    RETURN FALSE;
  END IF;

  SELECT public_booking_enabled
    INTO v_public_booking_enabled
  FROM profiles
  WHERE id = p_tutor_id;

  IF v_public_booking_enabled IS NOT TRUE THEN
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

