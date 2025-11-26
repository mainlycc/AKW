-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.billing_periods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT billing_periods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booked_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  student_assignment_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status text NOT NULL DEFAULT 'booked'::text CHECK (status = ANY (ARRAY['booked'::text, 'cancelled'::text])),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT booked_slots_pkey PRIMARY KEY (id),
  CONSTRAINT booked_slots_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT booked_slots_student_assignment_id_fkey FOREIGN KEY (student_assignment_id) REFERENCES public.student_assignments(id),
  CONSTRAINT booked_slots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.monthly_report_entries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  report_id uuid NOT NULL,
  student_id uuid NOT NULL,
  hours numeric NOT NULL CHECK (hours > 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monthly_report_entries_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_report_entries_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.monthly_reports(id),
  CONSTRAINT monthly_report_entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.monthly_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tutor_id uuid NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::report_status,
  total_hours numeric NOT NULL,
  total_amount numeric,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monthly_reports_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_reports_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT monthly_reports_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.parents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  parent_type USER-DEFINED NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT parents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_reminders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  billing_period_id uuid NOT NULL,
  reminder_date date NOT NULL,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT payment_reminders_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT payment_reminders_billing_period_id_fkey FOREIGN KEY (billing_period_id) REFERENCES public.billing_periods(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  billing_period_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method USER-DEFINED NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  stripe_payment_id text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT payments_billing_period_id_fkey FOREIGN KEY (billing_period_id) REFERENCES public.billing_periods(id),
  CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone text,
  bio text,
  hourly_rate numeric,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.public_booking_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tutor_id uuid NOT NULL,
  student_id uuid,
  assignment_id uuid,
  booked_slot_id uuid,
  request_date date NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::public_booking_status,
  student_first_name text NOT NULL,
  student_last_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  subject_id uuid,
  subject_level_id uuid,
  CONSTRAINT public_booking_requests_pkey PRIMARY KEY (id),
  CONSTRAINT public_booking_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT public_booking_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.student_assignments(id),
  CONSTRAINT public_booking_requests_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT public_booking_requests_booked_slot_id_fkey FOREIGN KEY (booked_slot_id) REFERENCES public.booked_slots(id),
  CONSTRAINT public_booking_requests_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT public_booking_requests_subject_level_id_fkey FOREIGN KEY (subject_level_id) REFERENCES public.subject_levels(id)
);
CREATE TABLE public.student_assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  subject_level_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'active'::assignment_status,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT student_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_assignments_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT student_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT student_assignments_subject_level_id_fkey FOREIGN KEY (subject_level_id) REFERENCES public.subject_levels(id),
  CONSTRAINT student_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.student_billings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  billing_period_id uuid NOT NULL,
  total_due numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'unpaid'::billing_status,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_billings_pkey PRIMARY KEY (id),
  CONSTRAINT student_billings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_billings_billing_period_id_fkey FOREIGN KEY (billing_period_id) REFERENCES public.billing_periods(id)
);
CREATE TABLE public.student_notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_notes_pkey PRIMARY KEY (id),
  CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.student_parents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_parents_pkey PRIMARY KEY (id),
  CONSTRAINT student_parents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_parents_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id)
);
CREATE TABLE public.student_subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  subject_level_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT student_subjects_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT student_subjects_subject_level_id_fkey FOREIGN KEY (subject_level_id) REFERENCES public.subject_levels(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  parent_email text,
  parent_phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  hourly_rate numeric NOT NULL DEFAULT 50.00,
  CONSTRAINT students_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subject_levels (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_id uuid NOT NULL,
  level_name text NOT NULL,
  level_order integer NOT NULL,
  price_per_hour numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subject_levels_pkey PRIMARY KEY (id),
  CONSTRAINT subject_levels_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tutor_availability_slots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tutor_availability_slots_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_availability_slots_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.tutor_availability_templates(id)
);
CREATE TABLE public.tutor_availability_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tutor_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tutor_availability_templates_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_availability_templates_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.tutor_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  token uuid NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::invitation_status,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tutor_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.tutor_subject_levels (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tutor_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  subject_level_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tutor_subject_levels_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_subject_levels_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT tutor_subject_levels_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT tutor_subject_levels_subject_level_id_fkey FOREIGN KEY (subject_level_id) REFERENCES public.subject_levels(id)
);
CREATE TABLE public.tutoring_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  assignment_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  session_date timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::session_status,
  CONSTRAINT tutoring_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT tutoring_sessions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.student_assignments(id),
  CONSTRAINT tutoring_sessions_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT tutoring_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT tutoring_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);