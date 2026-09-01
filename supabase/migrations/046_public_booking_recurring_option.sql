-- Migration 046: Opcja jednorazowa vs cykliczna rezerwacja publiczna

ALTER TABLE public.public_booking_requests
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.public_booking_requests
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.tutoring_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_session_id
  ON public.public_booking_requests(session_id);

COMMENT ON COLUMN public.public_booking_requests.is_recurring IS
  'TRUE = lekcja cykliczna (co tydzień, tworzy booked_slot); FALSE = jednorazowa (tworzy tutoring_session)';
