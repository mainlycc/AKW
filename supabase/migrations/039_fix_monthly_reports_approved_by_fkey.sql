-- Migration 039: Fix foreign keys to allow user deletion
-- This adds ON DELETE SET NULL to foreign key constraints
-- so that when a user is deleted, the referenced fields are set to NULL
-- instead of blocking the deletion

-- 1. Fix monthly_reports.approved_by foreign key
-- Drop the existing foreign key constraint
ALTER TABLE monthly_reports
DROP CONSTRAINT IF EXISTS monthly_reports_approved_by_fkey;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE monthly_reports
ADD CONSTRAINT monthly_reports_approved_by_fkey 
FOREIGN KEY (approved_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 2. Fix payments.created_by foreign key
-- First, make the column nullable (since it's currently NOT NULL)
ALTER TABLE payments
ALTER COLUMN created_by DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_created_by_fkey;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE payments
ADD CONSTRAINT payments_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 3. Fix monthly_declarations.approved_by foreign key
ALTER TABLE monthly_declarations
DROP CONSTRAINT IF EXISTS monthly_declarations_approved_by_fkey;

ALTER TABLE monthly_declarations
ADD CONSTRAINT monthly_declarations_approved_by_fkey 
FOREIGN KEY (approved_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 4. Fix student_notes.created_by foreign key
-- First, make the column nullable
ALTER TABLE student_notes
ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE student_notes
DROP CONSTRAINT IF EXISTS student_notes_created_by_fkey;

ALTER TABLE student_notes
ADD CONSTRAINT student_notes_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 5. Fix student_assignments.assigned_by foreign key
-- First, make the column nullable
ALTER TABLE student_assignments
ALTER COLUMN assigned_by DROP NOT NULL;

ALTER TABLE student_assignments
DROP CONSTRAINT IF EXISTS student_assignments_assigned_by_fkey;

ALTER TABLE student_assignments
ADD CONSTRAINT student_assignments_assigned_by_fkey 
FOREIGN KEY (assigned_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 6. Fix tutoring_sessions.created_by foreign key
-- First, make the column nullable
ALTER TABLE tutoring_sessions
ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE tutoring_sessions
DROP CONSTRAINT IF EXISTS tutoring_sessions_created_by_fkey;

ALTER TABLE tutoring_sessions
ADD CONSTRAINT tutoring_sessions_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;
