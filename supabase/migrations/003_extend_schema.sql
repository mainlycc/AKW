-- Migration 003: Extend schema for complete tutoring system

-- 1. Extend profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

-- 2. Create parent_type enum and parents table
CREATE TYPE parent_type AS ENUM ('mother', 'father', 'legal_guardian', 'other');

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  parent_type parent_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create student_parents junction table
CREATE TABLE student_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, parent_id)
);

-- 4. Create student_notes table
CREATE TABLE student_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_notes_student_id ON student_notes(student_id);
CREATE INDEX idx_student_notes_created_at ON student_notes(created_at);

-- 5. Create student_subjects table
CREATE TABLE student_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_level_id UUID NOT NULL REFERENCES subject_levels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_level_id)
);

CREATE INDEX idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX idx_student_subjects_subject_id ON student_subjects(subject_id);

-- 6. Create tutor_subject_levels table
CREATE TABLE tutor_subject_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_level_id UUID NOT NULL REFERENCES subject_levels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tutor_id, subject_level_id)
);

CREATE INDEX idx_tutor_subject_levels_tutor_id ON tutor_subject_levels(tutor_id);
CREATE INDEX idx_tutor_subject_levels_subject_id ON tutor_subject_levels(subject_id);

-- 7. Create report_status enum and monthly_reports table
CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved', 'paid');

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  status report_status NOT NULL DEFAULT 'draft',
  total_hours NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tutor_id, month, year)
);

CREATE INDEX idx_monthly_reports_tutor_id ON monthly_reports(tutor_id);
CREATE INDEX idx_monthly_reports_status ON monthly_reports(status);
CREATE INDEX idx_monthly_reports_month_year ON monthly_reports(month, year);

-- 8. Create monthly_report_entries table
CREATE TABLE monthly_report_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  hours NUMERIC(10, 2) NOT NULL CHECK (hours > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monthly_report_entries_report_id ON monthly_report_entries(report_id);
CREATE INDEX idx_monthly_report_entries_student_id ON monthly_report_entries(student_id);

-- 9. Create triggers for updated_at
CREATE TRIGGER update_parents_updated_at BEFORE UPDATE ON parents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_reports_updated_at BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Drop old columns from students (after data migration if needed)
-- Commented out for safety - run manually after migrating data to parents table
-- ALTER TABLE students DROP COLUMN IF EXISTS parent_email;
-- ALTER TABLE students DROP COLUMN IF EXISTS parent_phone;
-- ALTER TABLE students DROP COLUMN IF EXISTS notes;

