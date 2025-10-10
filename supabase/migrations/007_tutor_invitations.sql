-- Create invitation status enum
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Create tutor invitations table
CREATE TABLE tutor_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  status invitation_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_tutor_invitations_token ON tutor_invitations(token);
CREATE INDEX idx_tutor_invitations_status ON tutor_invitations(status);
CREATE INDEX idx_tutor_invitations_email ON tutor_invitations(email);
CREATE INDEX idx_tutor_invitations_expires_at ON tutor_invitations(expires_at);

-- Create trigger for updated_at
CREATE TRIGGER update_tutor_invitations_updated_at BEFORE UPDATE ON tutor_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tutor_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations" ON tutor_invitations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations" ON tutor_invitations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update invitations
CREATE POLICY "Admins can update invitations" ON tutor_invitations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations" ON tutor_invitations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE tutor_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

