-- Migration 023: Fix billing status logic for students with no sessions
-- This fixes the issue where students with no sessions (total_due = 0) 
-- were incorrectly marked as 'paid' instead of 'unpaid'

-- Add hourly_rate column to students table if not exists (default 50 PLN)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 50.00;

-- Update calculate_student_billing function
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

-- Update update_billing_after_payment function
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

-- Update update_billing_after_payment_delete function
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

