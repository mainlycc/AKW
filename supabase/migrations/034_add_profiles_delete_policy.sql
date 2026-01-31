-- Migration 034: Add DELETE policy for profiles table
--
-- Allow admins to delete profiles (tutors, students, etc.)

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
