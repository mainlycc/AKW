-- Add color column to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS color TEXT;

-- Function to generate a color based on subject name (for existing subjects without color)
CREATE OR REPLACE FUNCTION generate_subject_color(subject_name TEXT)
RETURNS TEXT AS $$
DECLARE
  color_palette TEXT[] := ARRAY[
    '#3b82f6', -- blue
    '#10b981', -- green
    '#f59e0b', -- amber
    '#ef4444', -- red
    '#8b5cf6', -- purple
    '#ec4899', -- pink
    '#06b6d4', -- cyan
    '#84cc16', -- lime
    '#f97316', -- orange
    '#6366f1', -- indigo
    '#14b8a6', -- teal
    '#a855f7', -- violet
    '#22c55e', -- emerald
    '#eab308', -- yellow
    '#64748b'  -- slate
  ];
  hash_value INTEGER;
BEGIN
  -- Generate hash from subject name
  hash_value := abs(hashtext(subject_name));
  -- Return color from palette based on hash
  RETURN color_palette[1 + (hash_value % array_length(color_palette, 1))];
END;
$$ LANGUAGE plpgsql;

-- Assign colors to existing subjects that don't have one
UPDATE subjects
SET color = generate_subject_color(name)
WHERE color IS NULL;

-- Drop the helper function (no longer needed after initial assignment)
DROP FUNCTION IF EXISTS generate_subject_color(TEXT);

