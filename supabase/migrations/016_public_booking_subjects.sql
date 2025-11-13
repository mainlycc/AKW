-- Migration 016: Add subject references to public booking requests

ALTER TABLE public_booking_requests
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_level_id UUID REFERENCES subject_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_booking_subject_id ON public_booking_requests(subject_id);
CREATE INDEX IF NOT EXISTS idx_public_booking_subject_level_id ON public_booking_requests(subject_level_id);


