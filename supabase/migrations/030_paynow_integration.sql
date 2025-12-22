-- Migration 030: Paynow Integration Schema

-- 1. Add paynow_payment_id column to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS paynow_payment_id TEXT;

-- 2. Create paynow_payments table
CREATE TABLE IF NOT EXISTS paynow_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id TEXT NOT NULL UNIQUE, -- Payment ID from Paynow (e.g., "NOLV-8F9-08K-WGD")
  external_id TEXT NOT NULL, -- External ID (student_id + billing_period_id)
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- NEW, PENDING, CONFIRMED, REJECTED, EXPIRED, ERROR
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  redirect_url TEXT,
  notification_url TEXT,
  return_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_id, billing_period_id)
);

-- 3. Create indexes for paynow_payments
CREATE INDEX IF NOT EXISTS idx_paynow_payments_payment_id ON paynow_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_paynow_payments_external_id ON paynow_payments(external_id);
CREATE INDEX IF NOT EXISTS idx_paynow_payments_student_id ON paynow_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_paynow_payments_billing_period_id ON paynow_payments(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_paynow_payments_status ON paynow_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_paynow_payment_id ON payments(paynow_payment_id);

-- 4. Add trigger for updated_at on paynow_payments
CREATE TRIGGER update_paynow_payments_updated_at 
  BEFORE UPDATE ON paynow_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable RLS on paynow_payments
ALTER TABLE paynow_payments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for paynow_payments
DROP POLICY IF EXISTS "Admins can do everything with paynow_payments" ON paynow_payments;
CREATE POLICY "Admins can do everything with paynow_payments"
  ON paynow_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 7. Function to link paynow payment with payment record
CREATE OR REPLACE FUNCTION link_paynow_payment(
  p_paynow_payment_id TEXT,
  p_payment_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE payments
  SET paynow_payment_id = p_paynow_payment_id,
      updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION link_paynow_payment(TEXT, UUID) TO authenticated;

