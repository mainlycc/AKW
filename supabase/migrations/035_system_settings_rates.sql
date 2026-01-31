-- Migration 035: System settings for default rates
-- This migration creates a system_settings table to store default hourly rates
-- for students and tutors, allowing admins to manage these values centrally

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read and write system settings
CREATE POLICY "Admins can do everything with system_settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default values
-- Default student rate: 50.00 PLN (matching the current default in students table)
INSERT INTO system_settings (key, value)
VALUES ('default_student_rate', '50.00')
ON CONFLICT (key) DO NOTHING;

-- Default tutor rate: NULL (tutors don't have a default rate set)
INSERT INTO system_settings (key, value)
VALUES ('default_tutor_rate', NULL)
ON CONFLICT (key) DO NOTHING;

-- Helper function to get default rate for students
CREATE OR REPLACE FUNCTION get_default_student_rate()
RETURNS NUMERIC(10, 2) AS $$
DECLARE
  v_rate NUMERIC(10, 2);
BEGIN
  SELECT COALESCE(value::NUMERIC, 50.00) INTO v_rate
  FROM system_settings
  WHERE key = 'default_student_rate';
  
  RETURN COALESCE(v_rate, 50.00);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get default rate for tutors
CREATE OR REPLACE FUNCTION get_default_tutor_rate()
RETURNS NUMERIC(10, 2) AS $$
DECLARE
  v_rate NUMERIC(10, 2);
BEGIN
  SELECT value::NUMERIC INTO v_rate
  FROM system_settings
  WHERE key = 'default_tutor_rate';
  
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE;
