-- Migration 037: Add UPDATE policy for admins on profiles table
--
-- Allow admins to update any profile (tutors, students, etc.)
-- This is needed for admin to edit tutor details like phone number

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
