-- Migration 012: Add public RLS policy for tutor invitations
-- Allows unauthenticated users to validate and use invitation tokens

-- Allow anyone to view invitations by token (needed for registration page)
CREATE POLICY "Anyone can view invitations by token" ON tutor_invitations
  FOR SELECT 
  TO anon, authenticated
  USING (true);

