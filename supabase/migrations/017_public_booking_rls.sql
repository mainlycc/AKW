-- Migration 017: Add RLS policies for public booking calendar
-- Allow anonymous users to read data needed for public booking

-- Allow anonymous users to view subjects
CREATE POLICY "Anonymous users can view subjects" ON subjects
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to view subject levels
CREATE POLICY "Anonymous users can view subject levels" ON subject_levels
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to view tutor subject levels
CREATE POLICY "Anonymous users can view tutor subject levels" ON tutor_subject_levels
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to view active tutor availability templates
CREATE POLICY "Anonymous users can view active templates" ON tutor_availability_templates
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow anonymous users to view slots for active templates
CREATE POLICY "Anonymous users can view active template slots" ON tutor_availability_slots
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tutor_availability_templates
      WHERE id = tutor_availability_slots.template_id
      AND is_active = true
    )
  );

-- Allow anonymous users to view booked slots (to check conflicts)
CREATE POLICY "Anonymous users can view booked slots" ON booked_slots
  FOR SELECT
  TO anon
  USING (status = 'booked');

-- Allow anonymous users to view pending public booking requests (to check conflicts)
CREATE POLICY "Anonymous users can view pending booking requests" ON public_booking_requests
  FOR SELECT
  TO anon
  USING (status = 'pending');

