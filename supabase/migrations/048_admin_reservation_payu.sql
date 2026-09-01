-- Migration 048: PayU payments for admin-created reservations

ALTER TABLE payu_payments
ADD COLUMN IF NOT EXISTS booked_slot_id UUID REFERENCES public.booked_slots(id) ON DELETE SET NULL;

ALTER TABLE payu_payments
ADD COLUMN IF NOT EXISTS tutoring_session_id UUID REFERENCES public.tutoring_sessions(id) ON DELETE SET NULL;

ALTER TABLE payu_payments
ADD COLUMN IF NOT EXISTS lesson_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_payu_payments_booked_slot_id ON payu_payments(booked_slot_id);
CREATE INDEX IF NOT EXISTS idx_payu_payments_tutoring_session_id ON payu_payments(tutoring_session_id);

ALTER TABLE payu_payments
DROP CONSTRAINT IF EXISTS check_payment_type;

ALTER TABLE payu_payments
ADD CONSTRAINT check_payment_type CHECK (
  (billing_period_id IS NOT NULL AND booking_request_id IS NULL AND booked_slot_id IS NULL AND tutoring_session_id IS NULL) OR
  (billing_period_id IS NULL AND booking_request_id IS NOT NULL AND booked_slot_id IS NULL AND tutoring_session_id IS NULL) OR
  (billing_period_id IS NULL AND booking_request_id IS NULL AND (booked_slot_id IS NOT NULL OR tutoring_session_id IS NOT NULL))
);
