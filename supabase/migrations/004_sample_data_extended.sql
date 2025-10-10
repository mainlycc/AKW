-- Migration 004: Sample data for extended schema

-- 1. Update existing tutor with phone, bio, hourly rate
UPDATE profiles 
SET 
  phone = '+48 123 456 789',
  bio = 'Doświadczony tutor matematyki z 5-letnim stażem',
  hourly_rate = 80.00
WHERE email = 'tutor@example.com';

-- 2. Insert sample parents
INSERT INTO parents (first_name, last_name, email, phone, parent_type) VALUES
  ('Anna', 'Kowalska', 'anna.kowalska@example.com', '+48 501 234 567', 'mother'),
  ('Piotr', 'Kowalski', 'piotr.kowalski@example.com', '+48 502 345 678', 'father'),
  ('Maria', 'Nowak', 'maria.nowak@example.com', '+48 503 456 789', 'mother'),
  ('Jan', 'Nowak', 'jan.nowak@example.com', '+48 504 567 890', 'father'),
  ('Katarzyna', 'Wiśniewska', 'katarzyna.wisniewska@example.com', '+48 505 678 901', 'legal_guardian');

-- 3. Link parents to students (assuming students from migration 002)
-- Get student IDs first, then link
DO $$
DECLARE
  student1_id UUID;
  student2_id UUID;
  student3_id UUID;
  parent1_id UUID;
  parent2_id UUID;
  parent3_id UUID;
  parent4_id UUID;
  parent5_id UUID;
BEGIN
  -- Get student IDs
  SELECT id INTO student1_id FROM students WHERE first_name = 'Jan' AND last_name = 'Kowalski' LIMIT 1;
  SELECT id INTO student2_id FROM students WHERE first_name = 'Anna' AND last_name = 'Nowak' LIMIT 1;
  SELECT id INTO student3_id FROM students WHERE first_name = 'Piotr' AND last_name = 'Wiśniewski' LIMIT 1;

  -- Get parent IDs
  SELECT id INTO parent1_id FROM parents WHERE email = 'anna.kowalska@example.com';
  SELECT id INTO parent2_id FROM parents WHERE email = 'piotr.kowalski@example.com';
  SELECT id INTO parent3_id FROM parents WHERE email = 'maria.nowak@example.com';
  SELECT id INTO parent4_id FROM parents WHERE email = 'jan.nowak@example.com';
  SELECT id INTO parent5_id FROM parents WHERE email = 'katarzyna.wisniewska@example.com';

  -- Link parents to students
  IF student1_id IS NOT NULL AND parent1_id IS NOT NULL THEN
    INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (student1_id, parent1_id, true);
  END IF;
  
  IF student1_id IS NOT NULL AND parent2_id IS NOT NULL THEN
    INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (student1_id, parent2_id, false);
  END IF;

  IF student2_id IS NOT NULL AND parent3_id IS NOT NULL THEN
    INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (student2_id, parent3_id, true);
  END IF;

  IF student2_id IS NOT NULL AND parent4_id IS NOT NULL THEN
    INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (student2_id, parent4_id, false);
  END IF;

  IF student3_id IS NOT NULL AND parent5_id IS NOT NULL THEN
    INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (student3_id, parent5_id, true);
  END IF;
END $$;

-- 4. Add tutor subject levels (tutor teaches Math at different levels)
DO $$
DECLARE
  tutor_id UUID;
  math_id UUID;
  basic_level_id UUID;
  intermediate_level_id UUID;
  advanced_level_id UUID;
BEGIN
  -- Get tutor ID
  SELECT id INTO tutor_id FROM profiles WHERE email = 'tutor@example.com';
  
  -- Get subject ID for Matematyka
  SELECT id INTO math_id FROM subjects WHERE name = 'Matematyka';
  
  -- Get level IDs
  SELECT id INTO basic_level_id FROM subject_levels WHERE subject_id = math_id AND level_name = 'Podstawowy';
  SELECT id INTO intermediate_level_id FROM subject_levels WHERE subject_id = math_id AND level_name = 'Średniozaawansowany';
  SELECT id INTO advanced_level_id FROM subject_levels WHERE subject_id = math_id AND level_name = 'Zaawansowany';

  -- Insert tutor subject levels
  IF tutor_id IS NOT NULL AND math_id IS NOT NULL THEN
    IF basic_level_id IS NOT NULL THEN
      INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id) 
      VALUES (tutor_id, math_id, basic_level_id)
      ON CONFLICT (tutor_id, subject_level_id) DO NOTHING;
    END IF;

    IF intermediate_level_id IS NOT NULL THEN
      INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id) 
      VALUES (tutor_id, math_id, intermediate_level_id)
      ON CONFLICT (tutor_id, subject_level_id) DO NOTHING;
    END IF;

    IF advanced_level_id IS NOT NULL THEN
      INSERT INTO tutor_subject_levels (tutor_id, subject_id, subject_level_id) 
      VALUES (tutor_id, math_id, advanced_level_id)
      ON CONFLICT (tutor_id, subject_level_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 5. Add student subjects
DO $$
DECLARE
  student1_id UUID;
  student2_id UUID;
  student3_id UUID;
  math_id UUID;
  basic_level_id UUID;
  intermediate_level_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO student1_id FROM students WHERE first_name = 'Jan' AND last_name = 'Kowalski' LIMIT 1;
  SELECT id INTO student2_id FROM students WHERE first_name = 'Anna' AND last_name = 'Nowak' LIMIT 1;
  SELECT id INTO student3_id FROM students WHERE first_name = 'Piotr' AND last_name = 'Wiśniewski' LIMIT 1;
  SELECT id INTO math_id FROM subjects WHERE name = 'Matematyka';
  SELECT id INTO basic_level_id FROM subject_levels WHERE subject_id = math_id AND level_name = 'Podstawowy';
  SELECT id INTO intermediate_level_id FROM subject_levels WHERE subject_id = math_id AND level_name = 'Średniozaawansowany';

  -- Link students to subjects
  IF student1_id IS NOT NULL AND math_id IS NOT NULL AND basic_level_id IS NOT NULL THEN
    INSERT INTO student_subjects (student_id, subject_id, subject_level_id) 
    VALUES (student1_id, math_id, basic_level_id)
    ON CONFLICT (student_id, subject_level_id) DO NOTHING;
  END IF;

  IF student2_id IS NOT NULL AND math_id IS NOT NULL AND intermediate_level_id IS NOT NULL THEN
    INSERT INTO student_subjects (student_id, subject_id, subject_level_id) 
    VALUES (student2_id, math_id, intermediate_level_id)
    ON CONFLICT (student_id, subject_level_id) DO NOTHING;
  END IF;

  IF student3_id IS NOT NULL AND math_id IS NOT NULL AND basic_level_id IS NOT NULL THEN
    INSERT INTO student_subjects (student_id, subject_id, subject_level_id) 
    VALUES (student3_id, math_id, basic_level_id)
    ON CONFLICT (student_id, subject_level_id) DO NOTHING;
  END IF;
END $$;

-- 6. Add sample student notes
DO $$
DECLARE
  student1_id UUID;
  student2_id UUID;
  tutor_id UUID;
BEGIN
  SELECT id INTO student1_id FROM students WHERE first_name = 'Jan' AND last_name = 'Kowalski' LIMIT 1;
  SELECT id INTO student2_id FROM students WHERE first_name = 'Anna' AND last_name = 'Nowak' LIMIT 1;
  SELECT id INTO tutor_id FROM profiles WHERE email = 'tutor@example.com';

  IF student1_id IS NOT NULL AND tutor_id IS NOT NULL THEN
    INSERT INTO student_notes (student_id, content, created_by) VALUES
      (student1_id, 'Uczeń bardzo się stara, robi postępy w algebrze', tutor_id),
      (student1_id, 'Trzeba popracować nad równaniami kwadratowymi', tutor_id);
  END IF;

  IF student2_id IS NOT NULL AND tutor_id IS NOT NULL THEN
    INSERT INTO student_notes (student_id, content, created_by) VALUES
      (student2_id, 'Świetne zrozumienie geometrii, potrzebuje więcej praktyki', tutor_id);
  END IF;
END $$;

-- 7. Add sample monthly report
DO $$
DECLARE
  tutor_id UUID;
  student1_id UUID;
  student2_id UUID;
  report_id UUID;
BEGIN
  SELECT id INTO tutor_id FROM profiles WHERE email = 'tutor@example.com';
  SELECT id INTO student1_id FROM students WHERE first_name = 'Jan' AND last_name = 'Kowalski' LIMIT 1;
  SELECT id INTO student2_id FROM students WHERE first_name = 'Anna' AND last_name = 'Nowak' LIMIT 1;

  IF tutor_id IS NOT NULL THEN
    -- Create draft report for previous month
    INSERT INTO monthly_reports (tutor_id, month, year, total_hours, status)
    VALUES (tutor_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 20.5, 'draft')
    RETURNING id INTO report_id;

    -- Add entries
    IF report_id IS NOT NULL AND student1_id IS NOT NULL THEN
      INSERT INTO monthly_report_entries (report_id, student_id, hours) VALUES (report_id, student1_id, 12.0);
    END IF;

    IF report_id IS NOT NULL AND student2_id IS NOT NULL THEN
      INSERT INTO monthly_report_entries (report_id, student_id, hours) VALUES (report_id, student2_id, 8.5);
    END IF;
  END IF;
END $$;

