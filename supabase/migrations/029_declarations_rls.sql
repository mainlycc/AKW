-- Migration 029: RLS Policies for Monthly Declarations

-- 1. Enable RLS on new tables
ALTER TABLE monthly_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_declaration_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaration_billings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Admins can do everything with monthly_declarations" ON monthly_declarations;
DROP POLICY IF EXISTS "Tutors can manage their own declarations" ON monthly_declarations;
DROP POLICY IF EXISTS "Admins can do everything with monthly_declaration_entries" ON monthly_declaration_entries;
DROP POLICY IF EXISTS "Tutors can manage entries in their own declarations" ON monthly_declaration_entries;
DROP POLICY IF EXISTS "Admins can do everything with declaration_billings" ON declaration_billings;
DROP POLICY IF EXISTS "Tutors can view their own declaration billings" ON declaration_billings;

-- 3. Policies for monthly_declarations
CREATE POLICY "Admins can do everything with monthly_declarations"
  ON monthly_declarations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can manage their own declarations"
  ON monthly_declarations FOR ALL
  TO authenticated
  USING (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

-- 4. Policies for monthly_declaration_entries
CREATE POLICY "Admins can do everything with monthly_declaration_entries"
  ON monthly_declaration_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can manage entries in their own declarations"
  ON monthly_declaration_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monthly_declarations md
      WHERE md.id = monthly_declaration_entries.declaration_id
      AND md.tutor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'tutor'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM monthly_declarations md
      WHERE md.id = monthly_declaration_entries.declaration_id
      AND md.tutor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'tutor'
      )
    )
  );

-- 5. Policies for declaration_billings
CREATE POLICY "Admins can do everything with declaration_billings"
  ON declaration_billings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Tutors can view their own declaration billings"
  ON declaration_billings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

