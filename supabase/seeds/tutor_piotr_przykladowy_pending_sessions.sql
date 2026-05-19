-- Lekcje do potwierdzenia dla tutora „Piotr Przykładowy”
-- Uruchom w Supabase SQL Editor (lub: supabase db execute)
-- Warunek w UI: status = 'scheduled' AND session_date < NOW()

INSERT INTO tutoring_sessions (
  assignment_id,
  tutor_id,
  student_id,
  session_date,
  duration_minutes,
  notes,
  created_by,
  status
)
SELECT
  sa.id,
  sa.tutor_id,
  sa.student_id,
  v.session_date,
  v.duration_minutes,
  v.notes,
  sa.tutor_id,
  'scheduled'::session_status
FROM student_assignments sa
JOIN profiles p ON p.id = sa.tutor_id
CROSS JOIN (
  VALUES
    ((CURRENT_DATE - 7) + TIME '16:00', 60, 'Lekcja do potwierdzenia – tydzień temu'),
    ((CURRENT_DATE - 5) + TIME '17:30', 90, 'Lekcja do potwierdzenia – piątek'),
    ((CURRENT_DATE - 3) + TIME '15:00', 60, 'Lekcja do potwierdzenia – środa'),
    ((CURRENT_DATE - 2) + TIME '18:00', 90, 'Lekcja do potwierdzenia – wtorek'),
    ((CURRENT_DATE - 1) + TIME '10:00', 60, 'Lekcja do potwierdzenia – wczoraj')
) AS v(session_date, duration_minutes, notes)
WHERE p.full_name = 'Piotr Przykładowy'
  AND p.role = 'tutor'
  AND sa.status = 'active';
