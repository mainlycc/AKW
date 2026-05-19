-- Migration 044: Onboarding tutorial progress on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'When the user finished the first-week onboarding tour';
COMMENT ON COLUMN public.profiles.onboarding_step IS 'Last completed onboarding step index (0-based)';
COMMENT ON COLUMN public.profiles.onboarding_skipped_at IS 'When the user skipped the onboarding tour';
