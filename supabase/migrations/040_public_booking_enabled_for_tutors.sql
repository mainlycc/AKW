-- Migration 040: Per-tutor toggle for public bookings

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_booking_enabled BOOLEAN NOT NULL DEFAULT TRUE;

