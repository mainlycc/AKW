-- Migration 050: Allow deleting tutor profiles without FK blocks
--
-- booked_slots.student_assignment_id used ON DELETE RESTRICT, which blocked
-- cascade deletes of student_assignments when removing a tutor profile.
-- booked_slots.created_by was NOT NULL with ON DELETE SET NULL (invalid combo).
--
-- All changes are guarded: missing tables are skipped (wrong DB / partial schema).

DO $$
BEGIN
  IF to_regclass('public.booked_slots') IS NULL THEN
    RAISE NOTICE '050: public.booked_slots does not exist — skipping booked_slots FK fixes';
  ELSE
    ALTER TABLE public.booked_slots
      DROP CONSTRAINT IF EXISTS booked_slots_student_assignment_id_fkey;

    ALTER TABLE public.booked_slots
      ADD CONSTRAINT booked_slots_student_assignment_id_fkey
      FOREIGN KEY (student_assignment_id)
      REFERENCES public.student_assignments(id)
      ON DELETE CASCADE;

    ALTER TABLE public.booked_slots
      ALTER COLUMN created_by DROP NOT NULL;

    ALTER TABLE public.booked_slots
      DROP CONSTRAINT IF EXISTS booked_slots_created_by_fkey;

    ALTER TABLE public.booked_slots
      ADD CONSTRAINT booked_slots_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;

    ALTER TABLE public.booked_slots
      DROP CONSTRAINT IF EXISTS booked_slots_tutor_id_fkey;

    ALTER TABLE public.booked_slots
      ADD CONSTRAINT booked_slots_tutor_id_fkey
      FOREIGN KEY (tutor_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tutor_availability_templates') IS NULL THEN
    RAISE NOTICE '050: public.tutor_availability_templates does not exist — skipping';
  ELSE
    ALTER TABLE public.tutor_availability_templates
      DROP CONSTRAINT IF EXISTS tutor_availability_templates_tutor_id_fkey;

    ALTER TABLE public.tutor_availability_templates
      ADD CONSTRAINT tutor_availability_templates_tutor_id_fkey
      FOREIGN KEY (tutor_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;
