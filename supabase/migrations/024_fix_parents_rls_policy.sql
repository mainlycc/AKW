-- Migration 024: Fix RLS policy for parents table to include WITH CHECK for INSERT
-- The previous policy only had USING which doesn't work for INSERT operations

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can do everything with parents" ON parents;

-- Recreate policy with both USING and WITH CHECK
CREATE POLICY "Admins can do everything with parents"
  ON parents FOR ALL
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

