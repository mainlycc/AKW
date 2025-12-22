-- Migration 028: Monthly Declarations Schema
-- System deklaracji miesięcznych dla tutorów

-- 1. Create declaration_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'declaration_status') THEN
    CREATE TYPE declaration_status AS ENUM ('draft', 'submitted', 'approved');
  END IF;
END
$$;

-- 2. Create monthly_declarations table
CREATE TABLE IF NOT EXISTS monthly_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  status declaration_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tutor_id, month, year)
);

-- 3. Create indexes for monthly_declarations
CREATE INDEX IF NOT EXISTS idx_monthly_declarations_tutor_id ON monthly_declarations(tutor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_declarations_status ON monthly_declarations(status);
CREATE INDEX IF NOT EXISTS idx_monthly_declarations_month_year ON monthly_declarations(month, year);

-- 4. Create monthly_declaration_entries table
CREATE TABLE IF NOT EXISTS monthly_declaration_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID NOT NULL REFERENCES monthly_declarations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  assignment_id UUID NOT NULL REFERENCES student_assignments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for monthly_declaration_entries
CREATE INDEX IF NOT EXISTS idx_declaration_entries_declaration_id ON monthly_declaration_entries(declaration_id);
CREATE INDEX IF NOT EXISTS idx_declaration_entries_student_id ON monthly_declaration_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_declaration_entries_session_date ON monthly_declaration_entries(session_date);
CREATE INDEX IF NOT EXISTS idx_declaration_entries_assignment_id ON monthly_declaration_entries(assignment_id);

-- 6. Create declaration_billings table for billing calculations
CREATE TABLE IF NOT EXISTS declaration_billings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  declaration_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, billing_period_id)
);

-- 7. Create indexes for declaration_billings
CREATE INDEX IF NOT EXISTS idx_declaration_billings_student_id ON declaration_billings(student_id);
CREATE INDEX IF NOT EXISTS idx_declaration_billings_period_id ON declaration_billings(billing_period_id);

-- 8. Add trigger for updated_at on monthly_declarations
CREATE TRIGGER update_monthly_declarations_updated_at 
  BEFORE UPDATE ON monthly_declarations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Add trigger for updated_at on declaration_billings
CREATE TRIGGER update_declaration_billings_updated_at 
  BEFORE UPDATE ON declaration_billings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

