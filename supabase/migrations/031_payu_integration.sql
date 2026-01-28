-- Migration 031: PayU Integration Schema

-- 1. Drop old Stripe column from payments table
ALTER TABLE payments
DROP COLUMN IF EXISTS stripe_payment_id;

-- 2. Add payu_order_id column to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payu_order_id TEXT;

-- 3. Rename paynow_payments table to payu_payments_old (for backup)
ALTER TABLE IF EXISTS paynow_payments RENAME TO paynow_payments_old;

-- 4. Create new payu_payments table
CREATE TABLE IF NOT EXISTS payu_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL UNIQUE, -- Order ID from PayU (e.g., "WZHF5FFDRJ140731GUEST000P01")
  ext_order_id TEXT NOT NULL, -- External ID (student_id + billing_period_id)
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- PENDING, WAITING_FOR_CONFIRMATION, COMPLETED, CANCELED
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  payment_method TEXT, -- Type of payment method used (e.g., "CARD_TOKEN", "PBL", "BLIK")
  redirect_url TEXT,
  notify_url TEXT,
  continue_url TEXT,
  description TEXT,
  buyer_email TEXT,
  buyer_first_name TEXT,
  buyer_last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ext_order_id, billing_period_id)
);

-- 5. Create indexes for payu_payments
CREATE INDEX IF NOT EXISTS idx_payu_payments_order_id ON payu_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payu_payments_ext_order_id ON payu_payments(ext_order_id);
CREATE INDEX IF NOT EXISTS idx_payu_payments_student_id ON payu_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payu_payments_billing_period_id ON payu_payments(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_payu_payments_status ON payu_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payu_order_id ON payments(payu_order_id);

-- 6. Add trigger for updated_at on payu_payments
CREATE TRIGGER update_payu_payments_updated_at 
  BEFORE UPDATE ON payu_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable RLS on payu_payments
ALTER TABLE payu_payments ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for payu_payments
DROP POLICY IF EXISTS "Admins can do everything with payu_payments" ON payu_payments;
CREATE POLICY "Admins can do everything with payu_payments"
  ON payu_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 9. Function to link payu payment with payment record
CREATE OR REPLACE FUNCTION link_payu_payment(
  p_payu_order_id TEXT,
  p_payment_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE payments
  SET payu_order_id = p_payu_order_id,
      updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION link_payu_payment(TEXT, UUID) TO authenticated;

-- 10. Migrate data from paynow_payments_old to payu_payments (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'paynow_payments_old') THEN
    INSERT INTO payu_payments (
      order_id,
      ext_order_id,
      student_id,
      billing_period_id,
      status,
      amount,
      currency,
      redirect_url,
      notify_url,
      created_at,
      updated_at
    )
    SELECT
      payment_id as order_id,
      external_id as ext_order_id,
      student_id,
      billing_period_id,
      CASE 
        WHEN status = 'CONFIRMED' THEN 'COMPLETED'
        WHEN status = 'REJECTED' THEN 'CANCELED'
        WHEN status = 'EXPIRED' THEN 'CANCELED'
        ELSE 'PENDING'
      END as status,
      amount,
      currency,
      redirect_url,
      notification_url as notify_url,
      created_at,
      updated_at
    FROM paynow_payments_old
    ON CONFLICT (ext_order_id, billing_period_id) DO NOTHING;
  END IF;
END $$;

-- 11. Update old payments records with payu_order_id from migrated data
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'paynow_payments_old') THEN
    UPDATE payments p
    SET payu_order_id = pp.order_id
    FROM payu_payments pp
    WHERE p.paynow_payment_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM paynow_payments_old ppo
        WHERE ppo.payment_id = pp.order_id
          AND ppo.payment_id = p.paynow_payment_id
      );
  END IF;
END $$;

-- 12. Drop old paynow_payment_id column from payments (after migration)
ALTER TABLE payments
DROP COLUMN IF EXISTS paynow_payment_id;

-- 13. Drop old paynow indexes if they exist
DROP INDEX IF EXISTS idx_paynow_payments_payment_id;
DROP INDEX IF EXISTS idx_paynow_payments_external_id;
DROP INDEX IF EXISTS idx_paynow_payments_student_id;
DROP INDEX IF EXISTS idx_paynow_payments_billing_period_id;
DROP INDEX IF EXISTS idx_paynow_payments_status;
DROP INDEX IF EXISTS idx_payments_paynow_payment_id;

-- 14. Drop old paynow function if exists
DROP FUNCTION IF EXISTS link_paynow_payment(TEXT, UUID);

-- 15. Comment: paynow_payments_old table can be manually dropped after verification
-- To drop it manually: DROP TABLE IF EXISTS paynow_payments_old CASCADE;
COMMENT ON TABLE paynow_payments_old IS 'Backup of old Paynow data. Can be dropped after verification of migration.';
