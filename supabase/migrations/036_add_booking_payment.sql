-- Migration 036: Add booking_request_id to payu_payments for public booking payments

-- 1. Make billing_period_id nullable (for booking payments it won't be set)
ALTER TABLE payu_payments
ALTER COLUMN billing_period_id DROP NOT NULL;

-- 2. Drop the unique constraint that requires billing_period_id
ALTER TABLE payu_payments
DROP CONSTRAINT IF EXISTS payu_payments_ext_order_id_billing_period_id_key;

-- 3. Add booking_request_id column
ALTER TABLE payu_payments
ADD COLUMN IF NOT EXISTS booking_request_id UUID REFERENCES public_booking_requests(id) ON DELETE SET NULL;

-- 4. Create index for booking_request_id
CREATE INDEX IF NOT EXISTS idx_payu_payments_booking_request_id ON payu_payments(booking_request_id);

-- 5. Create unique constraint for ext_order_id (since it should be unique per order)
-- Note: ext_order_id should be unique globally, but we keep the index for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_payu_payments_ext_order_id_unique ON payu_payments(ext_order_id) WHERE ext_order_id IS NOT NULL;

-- 6. Add check constraint to ensure either billing_period_id or booking_request_id is set
ALTER TABLE payu_payments
ADD CONSTRAINT check_payment_type CHECK (
  (billing_period_id IS NOT NULL AND booking_request_id IS NULL) OR
  (billing_period_id IS NULL AND booking_request_id IS NOT NULL)
);
