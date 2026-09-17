-- Migration 051: Allow PayU payment rows to keep history after linked slot/session is deleted
--
-- payu_payments.booked_slot_id / tutoring_session_id use ON DELETE SET NULL.
-- Deleting a tutor's booked_slots (or cascading tutoring_sessions) nulls those FKs.
-- The old check_payment_type required at least one type FK, so SET NULL failed with:
--   new row for relation "payu_payments" violates check constraint "check_payment_type"

ALTER TABLE payu_payments
DROP CONSTRAINT IF EXISTS check_payment_type;

ALTER TABLE payu_payments
ADD CONSTRAINT check_payment_type CHECK (
  -- Billing period payment
  (
    billing_period_id IS NOT NULL
    AND booking_request_id IS NULL
    AND booked_slot_id IS NULL
    AND tutoring_session_id IS NULL
  )
  OR
  -- Public booking payment
  (
    billing_period_id IS NULL
    AND booking_request_id IS NOT NULL
    AND booked_slot_id IS NULL
    AND tutoring_session_id IS NULL
  )
  OR
  -- Admin reservation / lesson payment (slot and/or session)
  (
    billing_period_id IS NULL
    AND booking_request_id IS NULL
    AND (booked_slot_id IS NOT NULL OR tutoring_session_id IS NOT NULL)
  )
  OR
  -- Detached historical payment (linked entity was deleted)
  (
    billing_period_id IS NULL
    AND booking_request_id IS NULL
    AND booked_slot_id IS NULL
    AND tutoring_session_id IS NULL
  )
);
