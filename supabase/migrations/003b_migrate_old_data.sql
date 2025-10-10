-- Migration 003b: Migrate old data from students to new tables
-- This should run AFTER 003_extend_schema.sql but BEFORE dropping columns

-- 1. Migrate parent_email and parent_phone from students to parents table
DO $$
DECLARE
  student_record RECORD;
  parent_id UUID;
BEGIN
  FOR student_record IN 
    SELECT id, parent_email, parent_phone, first_name, last_name 
    FROM students 
    WHERE parent_email IS NOT NULL
  LOOP
    -- Check if parent already exists by email
    SELECT id INTO parent_id FROM parents WHERE email = student_record.parent_email;
    
    IF parent_id IS NULL THEN
      -- Create new parent
      INSERT INTO parents (first_name, last_name, email, phone, parent_type)
      VALUES (
        'Rodzic', -- Default first name
        student_record.last_name, -- Use student's last name
        student_record.parent_email,
        student_record.parent_phone,
        'other' -- Default type
      )
      RETURNING id INTO parent_id;
    END IF;

    -- Link parent to student
    INSERT INTO student_parents (student_id, parent_id, is_primary)
    VALUES (student_record.id, parent_id, true)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END LOOP;
END $$;

-- 2. Migrate notes from students to student_notes
DO $$
DECLARE
  student_record RECORD;
  admin_id UUID;
BEGIN
  -- Get first admin as default creator
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  FOR student_record IN 
    SELECT id, notes 
    FROM students 
    WHERE notes IS NOT NULL AND notes != ''
  LOOP
    INSERT INTO student_notes (student_id, content, created_by)
    VALUES (student_record.id, student_record.notes, COALESCE(admin_id, student_record.id));
  END LOOP;
END $$;

-- Note: Columns parent_email, parent_phone, notes will be dropped in migration 003_extend_schema.sql
-- They are commented out for safety - uncomment manually after verifying data migration

