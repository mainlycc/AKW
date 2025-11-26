-- Migration 026: Allow tutors to create and link parents to students they create
-- This enables tutors to add parent information when creating new students

-- 1. Allow tutors to create parents (for students they are creating/assigning)
CREATE POLICY "Tutors can create parents for their students"
  ON parents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

-- 2. Allow tutors to insert student_parents relationships for students they have assignments with
-- This allows tutors to link parents to students they created or are assigned to
CREATE POLICY "Tutors can link parents to their students"
  ON student_parents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
    AND EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = student_parents.student_id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

