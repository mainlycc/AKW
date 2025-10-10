-- Migration 006: Make old student columns nullable

-- Change parent_email, parent_phone, notes to nullable
-- (instead of dropping them, for backward compatibility)

ALTER TABLE students 
ALTER COLUMN parent_email DROP NOT NULL;

-- These were already nullable, but just to be sure:
ALTER TABLE students 
ALTER COLUMN parent_phone DROP NOT NULL;

ALTER TABLE students 
ALTER COLUMN notes DROP NOT NULL;

