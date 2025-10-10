-- Migration 005: RLS Policies for extended schema

-- 0. Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Tutors can insert students" ON students;
DROP POLICY IF EXISTS "Tutors can update their assigned students" ON students;
DROP POLICY IF EXISTS "Tutors can delete their assigned students" ON students;
DROP POLICY IF EXISTS "Tutors can insert assignments for their students" ON student_assignments;
DROP POLICY IF EXISTS "Admins can do everything with parents" ON parents;
DROP POLICY IF EXISTS "Tutors can view parents of their students" ON parents;
DROP POLICY IF EXISTS "Admins can do everything with student_parents" ON student_parents;
DROP POLICY IF EXISTS "Tutors can view their students' parents" ON student_parents;
DROP POLICY IF EXISTS "Admins can do everything with student_notes" ON student_notes;
DROP POLICY IF EXISTS "Tutors can view notes for their students" ON student_notes;
DROP POLICY IF EXISTS "Tutors can create notes for their students" ON student_notes;
DROP POLICY IF EXISTS "Admins can do everything with student_subjects" ON student_subjects;
DROP POLICY IF EXISTS "Tutors can view their students' subjects" ON student_subjects;
DROP POLICY IF EXISTS "Tutors can insert subjects for new students" ON student_subjects;
DROP POLICY IF EXISTS "Admins can do everything with tutor_subject_levels" ON tutor_subject_levels;
DROP POLICY IF EXISTS "Tutors can manage their own subject levels" ON tutor_subject_levels;
DROP POLICY IF EXISTS "Everyone can view tutor subject levels" ON tutor_subject_levels;
DROP POLICY IF EXISTS "Admins can do everything with monthly_reports" ON monthly_reports;
DROP POLICY IF EXISTS "Tutors can manage their own reports" ON monthly_reports;
DROP POLICY IF EXISTS "Admins can do everything with monthly_report_entries" ON monthly_report_entries;
DROP POLICY IF EXISTS "Tutors can manage entries in their own reports" ON monthly_report_entries;

-- 1. Enable RLS on new tables
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subject_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_report_entries ENABLE ROW LEVEL SECURITY;

-- 2. Update students policies to allow tutors
CREATE POLICY "Tutors can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

CREATE POLICY "Tutors can update their assigned students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = students.id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

CREATE POLICY "Tutors can delete their assigned students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = students.id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

-- Also allow tutors to insert assignments for students they create
CREATE POLICY "Tutors can insert assignments for their students"
  ON student_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

-- 2. Parents policies
CREATE POLICY "Admins can do everything with parents"
  ON parents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can view parents of their students"
  ON parents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
    AND EXISTS (
      SELECT 1 FROM student_parents sp
      JOIN student_assignments sa ON sa.student_id = sp.student_id
      WHERE sp.parent_id = parents.id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

-- 3. Student_parents policies
CREATE POLICY "Admins can do everything with student_parents"
  ON student_parents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can view their students' parents"
  ON student_parents FOR SELECT
  TO authenticated
  USING (
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

-- 4. Student_notes policies
CREATE POLICY "Admins can do everything with student_notes"
  ON student_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can view notes for their students"
  ON student_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = student_notes.student_id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

CREATE POLICY "Tutors can create notes for their students"
  ON student_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = student_notes.student_id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

-- 5. Student_subjects policies
CREATE POLICY "Admins can do everything with student_subjects"
  ON student_subjects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can view their students' subjects"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.student_id = student_subjects.student_id
      AND sa.tutor_id = auth.uid()
      AND sa.status = 'active'
    )
  );

CREATE POLICY "Tutors can insert subjects for new students"
  ON student_subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

-- 6. Tutor_subject_levels policies
CREATE POLICY "Admins can do everything with tutor_subject_levels"
  ON tutor_subject_levels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can manage their own subject levels"
  ON tutor_subject_levels FOR ALL
  TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

CREATE POLICY "Everyone can view tutor subject levels"
  ON tutor_subject_levels FOR SELECT
  TO authenticated
  USING (true);

-- 7. Monthly_reports policies
CREATE POLICY "Admins can do everything with monthly_reports"
  ON monthly_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can manage their own reports"
  ON monthly_reports FOR ALL
  TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- 8. Monthly_report_entries policies
CREATE POLICY "Admins can do everything with monthly_report_entries"
  ON monthly_report_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can manage entries in their own reports"
  ON monthly_report_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = monthly_report_entries.report_id
      AND mr.tutor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = monthly_report_entries.report_id
      AND mr.tutor_id = auth.uid()
    )
  );

