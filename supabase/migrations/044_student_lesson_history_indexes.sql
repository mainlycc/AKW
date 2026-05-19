-- Speed up student lesson history lookups, including visually merged duplicate students.

CREATE INDEX IF NOT EXISTS idx_tutoring_sessions_student_status_date
ON public.tutoring_sessions (student_id, status, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_students_normalized_name
ON public.students (lower(trim(first_name)), lower(trim(last_name)));

CREATE OR REPLACE FUNCTION public.get_student_history_student_ids(p_student_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH selected_student AS (
    SELECT lower(trim(first_name)) AS first_name, lower(trim(last_name)) AS last_name
    FROM public.students
    WHERE students.id = p_student_id
  )
  SELECT students.id
  FROM public.students
  JOIN selected_student
    ON lower(trim(students.first_name)) = selected_student.first_name
   AND lower(trim(students.last_name)) = selected_student.last_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_student_history_student_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_student_history_student_ids(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_history_student_ids(uuid) TO authenticated;
