-- Migration 036: Student rate levels (3-level default rates + per-student level + override flag)
-- Adds:
-- - students.rate_level (1..3) with default 1
-- - students.hourly_rate_is_overridden (boolean) with default false
-- - system_settings keys: default_student_rate_level_1/2/3 (initialized from default_student_rate)

-- 1) Extend students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS rate_level integer NOT NULL DEFAULT 1;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS hourly_rate_is_overridden boolean NOT NULL DEFAULT false;

-- Ensure existing rows are valid (defensive)
UPDATE public.students
SET rate_level = 1
WHERE rate_level IS NULL;

-- Add / replace constraint (idempotent)
ALTER TABLE public.students
DROP CONSTRAINT IF EXISTS students_rate_level_check;

ALTER TABLE public.students
ADD CONSTRAINT students_rate_level_check CHECK (rate_level IN (1, 2, 3));

-- 2) Initialize system_settings keys for 3 student levels (copy from legacy default_student_rate)
INSERT INTO public.system_settings (key, value)
SELECT 'default_student_rate_level_1', COALESCE(ss.value, '50.00')
FROM public.system_settings ss
WHERE ss.key = 'default_student_rate'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
SELECT 'default_student_rate_level_2', COALESCE(ss.value, '50.00')
FROM public.system_settings ss
WHERE ss.key = 'default_student_rate'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
SELECT 'default_student_rate_level_3', COALESCE(ss.value, '50.00')
FROM public.system_settings ss
WHERE ss.key = 'default_student_rate'
ON CONFLICT (key) DO NOTHING;

-- If legacy key doesn't exist for some reason, still ensure keys exist
INSERT INTO public.system_settings (key, value)
VALUES
  ('default_student_rate_level_1', '50.00'),
  ('default_student_rate_level_2', '50.00'),
  ('default_student_rate_level_3', '50.00')
ON CONFLICT (key) DO NOTHING;

-- 3) Backfill hourly_rate_is_overridden using current legacy default (heuristic)
-- Mark as overridden when student's hourly_rate differs from default_student_rate.
-- This preserves most existing "custom" rates without requiring manual work.
UPDATE public.students s
SET hourly_rate_is_overridden = (
  s.hourly_rate IS DISTINCT FROM (
    SELECT COALESCE(value::numeric, 50.00)
    FROM public.system_settings
    WHERE key = 'default_student_rate'
  )
);

