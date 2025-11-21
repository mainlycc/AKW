-- Migration 022: Payments and Billing Schema

-- Add hourly_rate column to students table (default 50 PLN)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 50.00;

-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('transfer', 'cash', 'online');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_status') THEN
    CREATE TYPE billing_status AS ENUM ('paid', 'partially_paid', 'unpaid');
  END IF;
END
$$;

-- Billing periods table
CREATE TABLE IF NOT EXISTS billing_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Student billings table
CREATE TABLE IF NOT EXISTS student_billings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  total_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status billing_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, billing_period_id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  stripe_payment_id TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_billing_periods_month_year ON billing_periods(month, year);
CREATE INDEX IF NOT EXISTS idx_student_billings_student_id ON student_billings(student_id);
CREATE INDEX IF NOT EXISTS idx_student_billings_period_id ON student_billings(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_student_billings_status ON student_billings(status);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_period_id ON payments(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_student_id ON payment_reminders(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_period_id ON payment_reminders(billing_period_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_student_billings_updated_at ON student_billings;
CREATE TRIGGER update_student_billings_updated_at 
  BEFORE UPDATE ON student_billings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create billing period
CREATE OR REPLACE FUNCTION get_or_create_billing_period(p_month INTEGER, p_year INTEGER)
RETURNS UUID AS $$
DECLARE
  v_period_id UUID;
BEGIN
  SELECT id INTO v_period_id
  FROM billing_periods
  WHERE month = p_month AND year = p_year;
  
  IF v_period_id IS NULL THEN
    INSERT INTO billing_periods (month, year)
    VALUES (p_month, p_year)
    RETURNING id INTO v_period_id;
  END IF;
  
  RETURN v_period_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate and update student billing
CREATE OR REPLACE FUNCTION calculate_student_billing(
  p_student_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_period_id UUID;
  v_total_due NUMERIC(10, 2) := 0;
  v_total_paid NUMERIC(10, 2) := 0;
  v_balance NUMERIC(10, 2);
  v_status billing_status;
  v_billing_id UUID;
BEGIN
  -- Get or create billing period
  v_period_id := get_or_create_billing_period(p_month, p_year);
  
  -- Calculate total due from completed sessions
  -- Use hourly_rate from students table (default 50 PLN)
  SELECT COALESCE(SUM(
    (ts.duration_minutes::NUMERIC / 60.0) * COALESCE(s.hourly_rate, 50.0)
  ), 0)
  INTO v_total_due
  FROM tutoring_sessions ts
  INNER JOIN students s ON ts.student_id = s.id
  WHERE ts.student_id = p_student_id
    AND ts.status = 'completed'
    AND EXTRACT(MONTH FROM ts.session_date) = p_month
    AND EXTRACT(YEAR FROM ts.session_date) = p_year;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE student_id = p_student_id
    AND billing_period_id = v_period_id;
  
  -- Calculate balance
  v_balance := v_total_due - v_total_paid;
  
  -- Determine status
  -- If no sessions (total_due = 0), status should be 'unpaid'
  IF v_total_due = 0 THEN
    v_status := 'unpaid';
  ELSIF v_balance <= 0 THEN
    v_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_status := 'partially_paid';
  ELSE
    v_status := 'unpaid';
  END IF;
  
  -- Insert or update student billing
  INSERT INTO student_billings (
    student_id,
    billing_period_id,
    total_due,
    total_paid,
    balance,
    status
  )
  VALUES (
    p_student_id,
    v_period_id,
    v_total_due,
    v_total_paid,
    v_balance,
    v_status
  )
  ON CONFLICT (student_id, billing_period_id)
  DO UPDATE SET
    total_due = EXCLUDED.total_due,
    total_paid = EXCLUDED.total_paid,
    balance = EXCLUDED.balance,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO v_billing_id;
  
  RETURN v_billing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_student_billing(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_billing_period(INTEGER, INTEGER) TO authenticated;

-- Function to update billing after payment
CREATE OR REPLACE FUNCTION update_billing_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC(10, 2);
  v_total_due NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
  v_status billing_status;
BEGIN
  -- Calculate total paid for this billing period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE student_id = NEW.student_id
    AND billing_period_id = NEW.billing_period_id;
  
  -- Get total due
  SELECT total_due INTO v_total_due
  FROM student_billings
  WHERE student_id = NEW.student_id
    AND billing_period_id = NEW.billing_period_id;
  
  -- If billing doesn't exist, calculate it
  IF v_total_due IS NULL THEN
    PERFORM calculate_student_billing(
      NEW.student_id,
      (SELECT month FROM billing_periods WHERE id = NEW.billing_period_id),
      (SELECT year FROM billing_periods WHERE id = NEW.billing_period_id)
    );
    SELECT total_due INTO v_total_due
    FROM student_billings
    WHERE student_id = NEW.student_id
      AND billing_period_id = NEW.billing_period_id;
  END IF;
  
  -- Calculate balance
  v_balance := v_total_due - v_total_paid;
  
  -- Determine status
  -- If no sessions (total_due = 0), status should be 'unpaid'
  IF v_total_due = 0 THEN
    v_status := 'unpaid';
  ELSIF v_balance <= 0 THEN
    v_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_status := 'partially_paid';
  ELSE
    v_status := 'unpaid';
  END IF;
  
  -- Update student billing
  UPDATE student_billings
  SET
    total_paid = v_total_paid,
    balance = v_balance,
    status = v_status,
    updated_at = NOW()
  WHERE student_id = NEW.student_id
    AND billing_period_id = NEW.billing_period_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update billing after payment insert/update
DROP TRIGGER IF EXISTS update_billing_on_payment ON payments;
CREATE TRIGGER update_billing_on_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_after_payment();

-- Trigger to update billing after payment delete
CREATE OR REPLACE FUNCTION update_billing_after_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC(10, 2);
  v_total_due NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
  v_status billing_status;
BEGIN
  -- Calculate total paid for this billing period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE student_id = OLD.student_id
    AND billing_period_id = OLD.billing_period_id;
  
  -- Get total due
  SELECT total_due INTO v_total_due
  FROM student_billings
  WHERE student_id = OLD.student_id
    AND billing_period_id = OLD.billing_period_id;
  
  IF v_total_due IS NOT NULL THEN
    -- Calculate balance
    v_balance := v_total_due - v_total_paid;
    
    -- Determine status
    -- If no sessions (total_due = 0), status should be 'unpaid'
    IF v_total_due = 0 THEN
      v_status := 'unpaid';
    ELSIF v_balance <= 0 THEN
      v_status := 'paid';
    ELSIF v_total_paid > 0 THEN
      v_status := 'partially_paid';
    ELSE
      v_status := 'unpaid';
    END IF;
    
    -- Update student billing
    UPDATE student_billings
    SET
      total_paid = v_total_paid,
      balance = v_balance,
      status = v_status,
      updated_at = NOW()
    WHERE student_id = OLD.student_id
      AND billing_period_id = OLD.billing_period_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_billing_on_payment_delete ON payments;
CREATE TRIGGER update_billing_on_payment_delete
  AFTER DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_after_payment_delete();

-- Enable RLS
ALTER TABLE billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access
DROP POLICY IF EXISTS "Admins can do everything with billing_periods" ON billing_periods;
CREATE POLICY "Admins can do everything with billing_periods"
  ON billing_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can do everything with student_billings" ON student_billings;
CREATE POLICY "Admins can do everything with student_billings"
  ON student_billings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can do everything with payments" ON payments;
CREATE POLICY "Admins can do everything with payments"
  ON payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can do everything with payment_reminders" ON payment_reminders;
CREATE POLICY "Admins can do everything with payment_reminders"
  ON payment_reminders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

