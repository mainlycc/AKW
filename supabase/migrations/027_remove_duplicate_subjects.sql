-- Migration 027: Remove duplicate subjects (Matematyka and Język polski/Polski)
-- Ten skrypt usuwa duplikaty przedmiotów i przenosi wszystkie powiązania do oryginalnych

-- ============================================================================
-- 1. USUŃ DUPLIKATY PRZEDMIOTU "MATEMATYKA"
-- ============================================================================

-- Znajdź wszystkie przedmioty o nazwie "Matematyka"
-- Zachowaj najstarszy (najwcześniejszy created_at) jako oryginalny
WITH math_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Matematyka'
),
original_math AS (
  SELECT id FROM math_subjects WHERE rn = 1
),
duplicate_math AS (
  SELECT id FROM math_subjects WHERE rn > 1
)
-- Najpierw usuń poziomy z duplikatów (mogą kolidować z poziomami oryginalnego)
-- ponieważ oba przedmioty mają standardowe 3 poziomy
DELETE FROM subject_levels
WHERE subject_id IN (SELECT id FROM duplicate_math);

-- Przenieś powiązania w student_subjects
WITH math_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Matematyka'
),
original_math AS (
  SELECT id FROM math_subjects WHERE rn = 1
),
duplicate_math AS (
  SELECT id FROM math_subjects WHERE rn > 1
)
UPDATE student_subjects
SET subject_id = (SELECT id FROM original_math)
WHERE subject_id IN (SELECT id FROM duplicate_math)
  AND subject_id NOT IN (SELECT id FROM original_math);

-- Zaktualizuj student_assignments - po prostu zmień subject_id na oryginalny przedmiot
-- To nie powoduje problemu z foreign key, ponieważ nie usuwamy rekordów, tylko aktualizujemy pole
WITH math_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Matematyka'
),
original_math AS (
  SELECT id FROM math_subjects WHERE rn = 1
),
duplicate_math AS (
  SELECT id FROM math_subjects WHERE rn > 1
)
UPDATE student_assignments
SET subject_id = (SELECT id FROM original_math)
WHERE subject_id IN (SELECT id FROM duplicate_math)
  AND subject_id NOT IN (SELECT id FROM original_math);

-- Przenieś powiązania w tutor_subject_levels (jeśli istnieje)
DO $$
DECLARE
  original_math_id UUID;
  duplicate_math_ids UUID[];
BEGIN
  -- Znajdź oryginalny przedmiot Matematyka
  SELECT id INTO original_math_id
  FROM subjects
  WHERE name = 'Matematyka'
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Znajdź duplikaty
  SELECT ARRAY_AGG(id) INTO duplicate_math_ids
  FROM subjects
  WHERE name = 'Matematyka'
    AND id != original_math_id;
  
  -- Przenieś powiązania w tutor_subject_levels
  IF duplicate_math_ids IS NOT NULL AND array_length(duplicate_math_ids, 1) > 0 THEN
    UPDATE tutor_subject_levels
    SET subject_id = original_math_id
    WHERE subject_id = ANY(duplicate_math_ids);
  END IF;
END $$;

-- Przenieś powiązania w public_booking_requests
WITH math_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Matematyka'
),
original_math AS (
  SELECT id FROM math_subjects WHERE rn = 1
),
duplicate_math AS (
  SELECT id FROM math_subjects WHERE rn > 1
)
UPDATE public_booking_requests
SET subject_id = (SELECT id FROM original_math)
WHERE subject_id IN (SELECT id FROM duplicate_math)
  AND subject_id NOT IN (SELECT id FROM original_math);

-- Usuń duplikaty Matematyki (zachowaj tylko oryginalny)
WITH math_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Matematyka'
),
duplicate_math AS (
  SELECT id FROM math_subjects WHERE rn > 1
)
DELETE FROM subjects
WHERE id IN (SELECT id FROM duplicate_math);

-- ============================================================================
-- 2. USUŃ DUPLIKATY PRZEDMIOTU "JĘZYK POLSKI" / "POLSKI"
-- ============================================================================

-- Najpierw ujednolicimy nazwy - zmień "Polski" na "Język polski" jeśli istnieje
UPDATE subjects
SET name = 'Język polski'
WHERE name = 'Polski';

-- Teraz usuń duplikaty "Język polski"
WITH polish_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Język polski'
),
original_polish AS (
  SELECT id FROM polish_subjects WHERE rn = 1
),
duplicate_polish AS (
  SELECT id FROM polish_subjects WHERE rn > 1
)
-- Najpierw usuń poziomy z duplikatów (mogą kolidować z poziomami oryginalnego)
-- ponieważ oba przedmioty mają standardowe 3 poziomy
DELETE FROM subject_levels
WHERE subject_id IN (SELECT id FROM duplicate_polish);

-- Przenieś powiązania w student_subjects
WITH polish_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Język polski'
),
original_polish AS (
  SELECT id FROM polish_subjects WHERE rn = 1
),
duplicate_polish AS (
  SELECT id FROM polish_subjects WHERE rn > 1
)
UPDATE student_subjects
SET subject_id = (SELECT id FROM original_polish)
WHERE subject_id IN (SELECT id FROM duplicate_polish)
  AND subject_id NOT IN (SELECT id FROM original_polish);

-- Dla Języka polskiego: zaktualizuj student_assignments - po prostu zmień subject_id na oryginalny przedmiot
WITH polish_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Język polski'
),
original_polish AS (
  SELECT id FROM polish_subjects WHERE rn = 1
),
duplicate_polish AS (
  SELECT id FROM polish_subjects WHERE rn > 1
)
UPDATE student_assignments
SET subject_id = (SELECT id FROM original_polish)
WHERE subject_id IN (SELECT id FROM duplicate_polish)
  AND subject_id NOT IN (SELECT id FROM original_polish);

-- Przenieś powiązania w tutor_subject_levels
DO $$
DECLARE
  original_polish_id UUID;
  duplicate_polish_ids UUID[];
BEGIN
  -- Znajdź oryginalny przedmiot Język polski
  SELECT id INTO original_polish_id
  FROM subjects
  WHERE name = 'Język polski'
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Znajdź duplikaty
  SELECT ARRAY_AGG(id) INTO duplicate_polish_ids
  FROM subjects
  WHERE name = 'Język polski'
    AND id != original_polish_id;
  
  -- Przenieś powiązania w tutor_subject_levels
  IF duplicate_polish_ids IS NOT NULL AND array_length(duplicate_polish_ids, 1) > 0 THEN
    UPDATE tutor_subject_levels
    SET subject_id = original_polish_id
    WHERE subject_id = ANY(duplicate_polish_ids);
  END IF;
END $$;

-- Przenieś powiązania w public_booking_requests
WITH polish_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Język polski'
),
original_polish AS (
  SELECT id FROM polish_subjects WHERE rn = 1
),
duplicate_polish AS (
  SELECT id FROM polish_subjects WHERE rn > 1
)
UPDATE public_booking_requests
SET subject_id = (SELECT id FROM original_polish)
WHERE subject_id IN (SELECT id FROM duplicate_polish)
  AND subject_id NOT IN (SELECT id FROM original_polish);

-- Usuń duplikaty Języka polskiego (zachowaj tylko oryginalny)
WITH polish_subjects AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM subjects
  WHERE name = 'Język polski'
),
duplicate_polish AS (
  SELECT id FROM polish_subjects WHERE rn > 1
)
DELETE FROM subjects
WHERE id IN (SELECT id FROM duplicate_polish);

-- ============================================================================
-- 3. DODAJ UNIQUE CONSTRAINT NA NAZWĘ PRZEDMIOTU (aby zapobiec przyszłym duplikatom)
-- ============================================================================

-- Sprawdź czy constraint już istnieje, jeśli nie - dodaj go
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subjects_name_unique'
  ) THEN
    ALTER TABLE subjects ADD CONSTRAINT subjects_name_unique UNIQUE (name);
  END IF;
END $$;

