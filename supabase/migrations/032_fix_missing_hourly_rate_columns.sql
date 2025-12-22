-- Migration 032: Fix missing hourly_rate columns
-- This migration ensures that hourly_rate columns exist in both profiles and students tables
-- to fix PostgreSQL error 42703 (undefined column)

-- Add hourly_rate column to profiles table if not exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

-- Add hourly_rate column to students table if not exists (default 50 PLN)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 50.00;

-- Update existing NULL values in profiles.hourly_rate to NULL (keep as nullable)
-- This is intentional - tutors may not have hourly_rate set

-- Ensure students have default hourly_rate if somehow NULL values exist
UPDATE students 
SET hourly_rate = 50.00 
WHERE hourly_rate IS NULL;

