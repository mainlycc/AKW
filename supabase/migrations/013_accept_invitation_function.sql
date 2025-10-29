-- Migration 013: Add function to accept invitation by token
-- This function bypasses RLS using SECURITY DEFINER, allowing unauthenticated users
-- to update invitation status during registration

-- Function to update invitation status to 'accepted' when user registers
CREATE OR REPLACE FUNCTION accept_invitation_by_token(invitation_token UUID)
RETURNS void AS $$
BEGIN
  UPDATE tutor_invitations
  SET status = 'accepted'
  WHERE token = invitation_token
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION accept_invitation_by_token(UUID) TO anon, authenticated;

