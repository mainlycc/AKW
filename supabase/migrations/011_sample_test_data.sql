-- Migration 011: Sample test data for full application testing
-- UWAGA: Ten plik jest TYLKO do testowania w środowisku deweloperskim!
-- NIE uruchamiaj tego na produkcji!

-- Wyczyść istniejące dane testowe (opcjonalnie - odkomentuj jeśli chcesz)
-- DELETE FROM tutoring_sessions;
-- DELETE FROM student_assignments;
-- DELETE FROM monthly_report_entries;
-- DELETE FROM monthly_reports;
-- DELETE FROM tutor_availability_slots;
-- DELETE FROM tutor_availability_templates;
-- DELETE FROM student_parents;
-- DELETE FROM parents;
-- DELETE FROM students;
-- DELETE FROM tutor_subject_levels;
-- DELETE FROM subject_levels;
-- DELETE FROM subjects;
-- DELETE FROM tutor_invitations;
-- DELETE FROM profiles WHERE role = 'tutor';

-- UWAGA: Użytkownicy muszą być utworzeni przez Supabase Auth
-- Ten skrypt zakłada że masz już utworzonego admina i możesz ręcznie utworzyć tutorów
-- Poniżej UUIDs są przykładowe - zastąp je prawdziwymi UUID użytkowników z auth.users

-- ============================================================================
-- 1. PRZEDMIOTY I POZIOMY
-- ============================================================================

INSERT INTO subjects (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Matematyka', 'Matematyka - od podstaw do rozszerzenia'),
  ('a0000000-0000-0000-0000-000000000002', 'Fizyka', 'Fizyka - mechanika, elektryczność, optyka'),
  ('a0000000-0000-0000-0000-000000000003', 'Chemia', 'Chemia - substancje, reakcje, obliczenia'),
  ('a0000000-0000-0000-0000-000000000004', 'Angielski', 'Język angielski - gramatyka, konwersacje'),
  ('a0000000-0000-0000-0000-000000000005', 'Polski', 'Język polski - literatura, wypracowania'),
  ('a0000000-0000-0000-0000-000000000006', 'Informatyka', 'Informatyka - programowanie, algorytmy');

-- Poziomy dla każdego przedmiotu (3 standardowe)
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour) VALUES
  -- Matematyka
  ('a0000000-0000-0000-0000-000000000001', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000001', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000001', 'Szkoła średnia rozszerzenie', 3, 0),
  -- Fizyka
  ('a0000000-0000-0000-0000-000000000002', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000002', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000002', 'Szkoła średnia rozszerzenie', 3, 0),
  -- Chemia
  ('a0000000-0000-0000-0000-000000000003', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000003', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000003', 'Szkoła średnia rozszerzenie', 3, 0),
  -- Angielski
  ('a0000000-0000-0000-0000-000000000004', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000004', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000004', 'Szkoła średnia rozszerzenie', 3, 0),
  -- Polski
  ('a0000000-0000-0000-0000-000000000005', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000005', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000005', 'Szkoła średnia rozszerzenie', 3, 0),
  -- Informatyka
  ('a0000000-0000-0000-0000-000000000006', 'Szkoła podstawowa', 1, 0),
  ('a0000000-0000-0000-0000-000000000006', 'Szkoła średnia podstawa', 2, 0),
  ('a0000000-0000-0000-0000-000000000006', 'Szkoła średnia rozszerzenie', 3, 0);

-- ============================================================================
-- 2. INSTRUKCJE DLA TUTORÓW
-- ============================================================================

-- KROK 1: Utwórz tutorów przez Supabase Dashboard lub Auth API
-- Użyj tych emaili:
--   - tutor1@test.pl (hasło: Tutor123!)
--   - tutor2@test.pl (hasło: Tutor123!)
--   - tutor3@test.pl (hasło: Tutor123!)
--   - tutor4@test.pl (hasło: Tutor123!)

-- KROK 2: Po utworzeniu tutorów, skopiuj ich UUID z auth.users
-- KROK 3: Zastąp poniższe UUID prawdziwymi wartościami i odkomentuj

-- Przykład aktualizacji profili tutorów (ZASTĄP UUID!)
/*
UPDATE profiles SET 
  full_name = 'Anna Kowalska',
  phone = '+48 501 234 567',
  bio = 'Matematyczka z 10-letnim doświadczeniem. Specjalizuję się w przygotowaniu do matury.',
  hourly_rate = 80.00
WHERE id = 'TUTAJ_UUID_TUTOR1';

UPDATE profiles SET 
  full_name = 'Jan Nowak',
  phone = '+48 502 345 678',
  bio = 'Fizyk i chemik. Pomagam w zrozumieniu trudnych zagadnień.',
  hourly_rate = 75.00
WHERE id = 'TUTAJ_UUID_TUTOR2';

UPDATE profiles SET 
  full_name = 'Maria Wiśniewska',
  phone = '+48 503 456 789',
  bio = 'Nauczyciel języka angielskiego. Cambridge certified.',
  hourly_rate = 70.00
WHERE id = 'TUTAJ_UUID_TUTOR3';

UPDATE profiles SET 
  full_name = 'Piotr Zieliński',
  phone = '+48 504 567 890',
  bio = 'Informatyk, programista. Uczę programowania od podstaw.',
  hourly_rate = 90.00
WHERE id = 'TUTAJ_UUID_TUTOR4';
*/

-- ============================================================================
-- 3. UCZNIOWIE
-- ============================================================================

INSERT INTO students (id, first_name, last_name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Zofia', 'Lewandowska'),
  ('10000000-0000-0000-0000-000000000002', 'Kacper', 'Woźniak'),
  ('10000000-0000-0000-0000-000000000003', 'Julia', 'Kaczmarek'),
  ('10000000-0000-0000-0000-000000000004', 'Filip', 'Szymański'),
  ('10000000-0000-0000-0000-000000000005', 'Maja', 'Dąbrowska'),
  ('10000000-0000-0000-0000-000000000006', 'Aleksander', 'Kozłowski'),
  ('10000000-0000-0000-0000-000000000007', 'Amelia', 'Jankowska'),
  ('10000000-0000-0000-0000-000000000008', 'Mikołaj', 'Mazur');

-- ============================================================================
-- 4. RODZICE
-- ============================================================================

INSERT INTO parents (id, first_name, last_name, email, phone, parent_type) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Katarzyna', 'Lewandowska', 'k.lewandowska@example.com', '+48 601 111 111', 'mother'),
  ('20000000-0000-0000-0000-000000000002', 'Robert', 'Lewandowski', 'r.lewandowski@example.com', '+48 602 111 111', 'father'),
  ('20000000-0000-0000-0000-000000000003', 'Magdalena', 'Woźniak', 'm.wozniak@example.com', '+48 603 222 222', 'mother'),
  ('20000000-0000-0000-0000-000000000004', 'Beata', 'Kaczmarek', 'b.kaczmarek@example.com', '+48 604 333 333', 'mother'),
  ('20000000-0000-0000-0000-000000000005', 'Tomasz', 'Szymański', 't.szymanski@example.com', '+48 605 444 444', 'father'),
  ('20000000-0000-0000-0000-000000000006', 'Ewa', 'Dąbrowska', 'e.dabrowska@example.com', '+48 606 555 555', 'mother'),
  ('20000000-0000-0000-0000-000000000007', 'Paweł', 'Kozłowski', 'p.kozlowski@example.com', '+48 607 666 666', 'legal_guardian'),
  ('20000000-0000-0000-0000-000000000008', 'Anna', 'Jankowska', 'a.jankowska@example.com', '+48 608 777 777', 'mother'),
  ('20000000-0000-0000-0000-000000000009', 'Krzysztof', 'Mazur', 'k.mazur@example.com', '+48 609 888 888', 'father');

-- Powiązania uczniów z rodzicami
INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', false),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', true),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', true),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', true),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000007', true),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', true),
  ('10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000009', true);

-- ============================================================================
-- 5. PRZEDMIOTY TUTORÓW (po utworzeniu tutorów - ZASTĄP UUID!)
-- ============================================================================

-- Przykład przypisania przedmiotów do tutorów (ODKOMENTUJ I ZASTĄP UUID!)
/*
-- Anna Kowalska - Matematyka (wszystkie poziomy)
INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id)
SELECT 'UUID_TUTOR1', subject_id, id
FROM subject_levels
WHERE subject_id = 'a0000000-0000-0000-0000-000000000001';

-- Jan Nowak - Fizyka i Chemia
INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id)
SELECT 'UUID_TUTOR2', subject_id, id
FROM subject_levels
WHERE subject_id IN ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');

-- Maria Wiśniewska - Angielski
INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id)
SELECT 'UUID_TUTOR3', subject_id, id
FROM subject_levels
WHERE subject_id = 'a0000000-0000-0000-0000-000000000004';

-- Piotr Zieliński - Informatyka i Matematyka
INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id)
SELECT 'UUID_TUTOR4', subject_id, id
FROM subject_levels
WHERE subject_id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006');
*/

-- ============================================================================
-- 6. PRZYPISANIA UCZNIÓW DO TUTORÓW (ZASTĄP UUID TUTORÓW I ADMINA!)
-- ============================================================================

/*
-- Pobierz ID poziomu "Szkoła średnia rozszerzenie" dla Matematyki
WITH math_advanced AS (
  SELECT id FROM subject_levels 
  WHERE subject_id = 'a0000000-0000-0000-0000-000000000001' 
  AND level_order = 3
),
-- Pobierz ID poziomu "Szkoła średnia podstawa" dla Fizyki
physics_basic AS (
  SELECT id FROM subject_levels 
  WHERE subject_id = 'a0000000-0000-0000-0000-000000000002' 
  AND level_order = 2
),
-- Pobierz ID poziomu "Szkoła średnia podstawa" dla Angielskiego
english_basic AS (
  SELECT id FROM subject_levels 
  WHERE subject_id = 'a0000000-0000-0000-0000-000000000004' 
  AND level_order = 2
)

INSERT INTO student_assignments (student_id, tutor_id, subject_id, subject_level_id, assigned_by, status) VALUES
  -- Zofia -> Anna (Matematyka rozszerzenie)
  ('10000000-0000-0000-0000-000000000001', 'UUID_TUTOR1', 'a0000000-0000-0000-0000-000000000001', (SELECT id FROM math_advanced), 'UUID_ADMIN', 'active'),
  -- Kacper -> Jan (Fizyka podstawa)
  ('10000000-0000-0000-0000-000000000002', 'UUID_TUTOR2', 'a0000000-0000-0000-0000-000000000002', (SELECT id FROM physics_basic), 'UUID_ADMIN', 'active'),
  -- Julia -> Maria (Angielski podstawa)
  ('10000000-0000-0000-0000-000000000003', 'UUID_TUTOR3', 'a0000000-0000-0000-0000-000000000004', (SELECT id FROM english_basic), 'UUID_ADMIN', 'active'),
  -- Filip -> Anna (Matematyka podstawa)
  ('10000000-0000-0000-0000-000000000004', 'UUID_TUTOR1', 'a0000000-0000-0000-0000-000000000001', 
   (SELECT id FROM subject_levels WHERE subject_id = 'a0000000-0000-0000-0000-000000000001' AND level_order = 1), 
   'UUID_ADMIN', 'active');
*/

-- ============================================================================
-- 7. SESJE KOREPETYCJI (ZASTĄP UUID!)
-- ============================================================================

/*
-- Sesje dla Zofii z Anną (Matematyka)
WITH assignment AS (
  SELECT id FROM student_assignments 
  WHERE student_id = '10000000-0000-0000-0000-000000000001' 
  AND tutor_id = 'UUID_TUTOR1'
  LIMIT 1
)
INSERT INTO tutoring_sessions (assignment_id, tutor_id, student_id, session_date, duration_minutes, notes, created_by) VALUES
  ((SELECT id FROM assignment), 'UUID_TUTOR1', '10000000-0000-0000-0000-000000000001', 
   NOW() - INTERVAL '7 days', 90, 'Pochodne i całki - bardzo dobry postęp', 'UUID_TUTOR1'),
  ((SELECT id FROM assignment), 'UUID_TUTOR1', '10000000-0000-0000-0000-000000000001', 
   NOW() - INTERVAL '3 days', 90, 'Równania różniczkowe', 'UUID_TUTOR1'),
  ((SELECT id FROM assignment), 'UUID_TUTOR1', '10000000-0000-0000-0000-000000000001', 
   NOW() - INTERVAL '1 day', 120, 'Przygotowanie do matury - zadania maturalne', 'UUID_TUTOR1');

-- Sesje dla Kacpra z Janem (Fizyka)
WITH assignment AS (
  SELECT id FROM student_assignments 
  WHERE student_id = '10000000-0000-0000-0000-000000000002' 
  AND tutor_id = 'UUID_TUTOR2'
  LIMIT 1
)
INSERT INTO tutoring_sessions (assignment_id, tutor_id, student_id, session_date, duration_minutes, notes, created_by) VALUES
  ((SELECT id FROM assignment), 'UUID_TUTOR2', '10000000-0000-0000-0000-000000000002', 
   NOW() - INTERVAL '5 days', 60, 'Mechanika - prawa Newtona', 'UUID_TUTOR2'),
  ((SELECT id FROM assignment), 'UUID_TUTOR2', '10000000-0000-0000-0000-000000000002', 
   NOW() - INTERVAL '2 days', 90, 'Energia i praca', 'UUID_TUTOR2');
*/

-- ============================================================================
-- 8. KALENDARZE DOSTĘPNOŚCI TUTORÓW (ZASTĄP UUID!)
-- ============================================================================

/*
-- Kalendarz dla Anny Kowalskiej (przykładowy)
WITH template AS (
  INSERT INTO tutor_availability_templates (tutor_id, version, is_active)
  VALUES ('UUID_TUTOR1', 1, true)
  RETURNING id
)
INSERT INTO tutor_availability_slots (template_id, day_of_week, start_time, end_time, is_available)
SELECT 
  (SELECT id FROM template),
  day,
  time_start,
  time_end,
  true
FROM (VALUES
  -- Poniedziałek 14:00-18:00
  (1, '14:00', '14:30'), (1, '14:30', '15:00'), (1, '15:00', '15:30'), (1, '15:30', '16:00'),
  (1, '16:00', '16:30'), (1, '16:30', '17:00'), (1, '17:00', '17:30'), (1, '17:30', '18:00'),
  -- Wtorek 16:00-21:00
  (2, '16:00', '16:30'), (2, '16:30', '17:00'), (2, '17:00', '17:30'), (2, '17:30', '18:00'),
  (2, '18:00', '18:30'), (2, '18:30', '19:00'), (2, '19:00', '19:30'), (2, '19:30', '20:00'),
  (2, '20:00', '20:30'), (2, '20:30', '21:00'),
  -- Środa 14:00-19:00
  (3, '14:00', '14:30'), (3, '14:30', '15:00'), (3, '15:00', '15:30'), (3, '15:30', '16:00'),
  (3, '16:00', '16:30'), (3, '16:30', '17:00'), (3, '17:00', '17:30'), (3, '17:30', '18:00'),
  (3, '18:00', '18:30'), (3, '18:30', '19:00'),
  -- Sobota 9:00-13:00
  (6, '09:00', '09:30'), (6, '09:30', '10:00'), (6, '10:00', '10:30'), (6, '10:30', '11:00'),
  (6, '11:00', '11:30'), (6, '11:30', '12:00'), (6, '12:00', '12:30'), (6, '12:30', '13:00')
) AS slots(day, time_start, time_end);
*/

-- ============================================================================
-- 9. RAPORTY MIESIĘCZNE (ZASTĄP UUID!)
-- ============================================================================

/*
-- Raport dla Anny za bieżący miesiąc (draft)
WITH report AS (
  INSERT INTO monthly_reports (tutor_id, month, year, status, total_hours)
  VALUES ('UUID_TUTOR1', EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 'draft', 15.5)
  RETURNING id
)
INSERT INTO monthly_report_entries (report_id, student_id, hours) VALUES
  ((SELECT id FROM report), '10000000-0000-0000-0000-000000000001', 10.5),
  ((SELECT id FROM report), '10000000-0000-0000-0000-000000000004', 5.0);

-- Raport dla Jana za ubiegły miesiąc (submitted)
WITH report AS (
  INSERT INTO monthly_reports (tutor_id, month, year, status, total_hours, submitted_at)
  VALUES ('UUID_TUTOR2', 
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) = 1 THEN 12 ELSE EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER - 1 END,
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) = 1 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1 ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER END,
    'submitted', 12.0, NOW() - INTERVAL '2 days')
  RETURNING id
)
INSERT INTO monthly_report_entries (report_id, student_id, hours) VALUES
  ((SELECT id FROM report), '10000000-0000-0000-0000-000000000002', 12.0);
*/

-- ============================================================================
-- 10. ZAPROSZENIA DLA NOWYCH TUTORÓW
-- ============================================================================

/*
INSERT INTO tutor_invitations (email, status, created_by, expires_at) VALUES
  ('nowy.tutor@test.pl', 'pending', 'UUID_ADMIN', NOW() + INTERVAL '7 days'),
  ('inny.tutor@test.pl', 'pending', 'UUID_ADMIN', NOW() + INTERVAL '7 days'),
  ('stary.tutor@test.pl', 'expired', 'UUID_ADMIN', NOW() - INTERVAL '1 day');
*/

-- ============================================================================
-- INSTRUKCJE KOŃCOWE
-- ============================================================================

/*
KROK PO KROKU:

1. Utwórz 4 tutorów przez Supabase Auth Dashboard:
   - Email: tutor1@test.pl, Hasło: Tutor123!, Full name: Anna Kowalska
   - Email: tutor2@test.pl, Hasło: Tutor123!, Full name: Jan Nowak
   - Email: tutor3@test.pl, Hasło: Tutor123!, Full name: Maria Wiśniewska
   - Email: tutor4@test.pl, Hasło: Tutor123!, Full name: Piotr Zieliński

2. Skopiuj UUID każdego tutora z tabeli auth.users

3. Znajdź UUID admina w tabeli profiles (WHERE role = 'admin')

4. Zastąp UUID_TUTOR1, UUID_TUTOR2, UUID_TUTOR3, UUID_TUTOR4, UUID_ADMIN w kodzie powyżej

5. Odkomentuj sekcje które chcesz uruchomić (UPDATE profiles, INSERT INTO tutor_subject_levels, etc.)

6. Uruchom skrypt

PRZYKŁAD QUERY DO ZNALEZIENIA UUID:
SELECT id, email, raw_user_meta_data->>'full_name' as name FROM auth.users;
SELECT id, email, full_name, role FROM profiles;
*/

-- Notatki dla uczniów
INSERT INTO student_notes (student_id, content, created_by) 
SELECT 
  '10000000-0000-0000-0000-000000000001',
  'Uczeń bardzo zaangażowany, szybko przyswaja materiał.',
  id
FROM profiles WHERE role = 'admin' LIMIT 1;

INSERT INTO student_notes (student_id, content, created_by) 
SELECT 
  '10000000-0000-0000-0000-000000000002',
  'Potrzebuje więcej ćwiczeń praktycznych.',
  id
FROM profiles WHERE role = 'admin' LIMIT 1;

