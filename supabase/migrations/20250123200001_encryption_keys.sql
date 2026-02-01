-- Migration: Encryption Keys Table
-- Stores encryption key metadata for HIPAA-compliant recording encryption
-- Prerequisites: Run AFTER core_tables.sql and 20250122200002_hipaa_compliance.sql

-- ============================================
-- Encryption Keys Table
-- Stores encryption key metadata (NOT actual keys)
-- Keys are encrypted with master key and stored in key_encrypted
-- ============================================
CREATE TABLE encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key_encrypted text NOT NULL, -- Master-key-encrypted data key (NOT the raw key)
  key_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  is_active boolean NOT NULL DEFAULT true, -- For backward compatibility with existing queries
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz, -- When key was rotated (replaced by newer key)
  revoked_at timestamptz, -- When key was revoked (should not be used)
  revoked_by uuid REFERENCES auth.users(id), -- User who revoked the key
  revocation_reason text, -- Why the key was revoked

  -- Ensure only one active key per business
  CONSTRAINT unique_active_key_per_business UNIQUE (business_id, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE encryption_keys IS 'Encryption key metadata for HIPAA-compliant recording encryption';
COMMENT ON COLUMN encryption_keys.key_encrypted IS 'Master-key-encrypted data key. The actual key is encrypted with HIPAA_MASTER_KEY and stored here.';
COMMENT ON COLUMN encryption_keys.key_version IS 'Key version number, incremented on each rotation';
COMMENT ON COLUMN encryption_keys.status IS 'Key status: active (in use), rotated (replaced), revoked (invalidated)';
COMMENT ON COLUMN encryption_keys.is_active IS 'Whether this is the active key for the business. Only one active key per business.';
COMMENT ON COLUMN encryption_keys.created_at IS 'When the key was created';
COMMENT ON COLUMN encryption_keys.rotated_at IS 'When this key was rotated and replaced by a new key';
COMMENT ON COLUMN encryption_keys.revoked_at IS 'When this key was revoked (compromised or no longer needed)';
COMMENT ON COLUMN encryption_keys.revoked_by IS 'User who revoked the key';
COMMENT ON COLUMN encryption_keys.revocation_reason IS 'Reason for key revocation';

-- ============================================
-- Indexes for performance
-- ============================================
-- Index for looking up active key by business (most common query)
CREATE INDEX idx_encryption_keys_business_active ON encryption_keys(business_id)
  WHERE is_active = true;

-- Index for looking up key by ID (for decryption)
CREATE INDEX idx_encryption_keys_id ON encryption_keys(id);

-- Index for querying by status
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);

-- Index for business_id for general queries
CREATE INDEX idx_encryption_keys_business_id ON encryption_keys(business_id);

-- Index for audit queries on key creation/rotation
CREATE INDEX idx_encryption_keys_created_at ON encryption_keys(created_at DESC);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Users can view encryption key metadata for their business
-- NOTE: They cannot see the actual encrypted key content in the application
-- This policy allows metadata visibility (id, version, status, timestamps)
CREATE POLICY "Users can view own business encryption keys" ON encryption_keys
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Only service role can insert keys (keys are created by the system)
CREATE POLICY "Service role can insert encryption keys" ON encryption_keys
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update keys (rotation is done by the system)
CREATE POLICY "Service role can update encryption keys" ON encryption_keys
  FOR UPDATE USING (auth.role() = 'service_role');

-- Service role bypass for all operations
CREATE POLICY "Service role bypass encryption_keys" ON encryption_keys
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to get active encryption key for business
-- ============================================
CREATE OR REPLACE FUNCTION get_active_encryption_key(p_business_id uuid)
RETURNS TABLE (
  key_id uuid,
  key_encrypted text,
  key_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ek.id, ek.key_encrypted, ek.key_version
  FROM encryption_keys ek
  WHERE ek.business_id = p_business_id
    AND ek.is_active = true
    AND ek.status = 'active'
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_encryption_key IS 'Get the active encryption key for a business';

-- ============================================
-- Function to rotate encryption key
-- Deactivates current key and prepares for new key insertion
-- ============================================
CREATE OR REPLACE FUNCTION rotate_encryption_key(
  p_business_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_key_id uuid;
  v_old_version integer;
BEGIN
  -- Get current active key
  SELECT id, key_version INTO v_old_key_id, v_old_version
  FROM encryption_keys
  WHERE business_id = p_business_id
    AND is_active = true
  FOR UPDATE;

  -- If there's an existing key, mark it as rotated
  IF v_old_key_id IS NOT NULL THEN
    UPDATE encryption_keys
    SET
      is_active = false,
      status = 'rotated',
      rotated_at = now()
    WHERE id = v_old_key_id;

    -- Log the rotation in PHI audit log
    INSERT INTO phi_audit_log (
      business_id,
      user_id,
      event_type,
      resource_type,
      resource_id,
      action,
      metadata
    ) VALUES (
      p_business_id,
      p_user_id,
      'phi_modify',
      'encryption_key',
      v_old_key_id,
      'rotate_encryption_key',
      jsonb_build_object('old_key_id', v_old_key_id, 'old_version', v_old_version)
    );
  END IF;

  RETURN v_old_key_id;
END;
$$;

COMMENT ON FUNCTION rotate_encryption_key IS 'Deactivate current encryption key and prepare for rotation';

-- ============================================
-- Function to revoke encryption key
-- Used when a key is compromised or needs to be invalidated
-- ============================================
CREATE OR REPLACE FUNCTION revoke_encryption_key(
  p_key_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_key_version integer;
BEGIN
  -- Get key details
  SELECT business_id, key_version INTO v_business_id, v_key_version
  FROM encryption_keys
  WHERE id = p_key_id
  FOR UPDATE;

  IF v_business_id IS NULL THEN
    RETURN false;
  END IF;

  -- Revoke the key
  UPDATE encryption_keys
  SET
    is_active = false,
    status = 'revoked',
    revoked_at = now(),
    revoked_by = p_user_id,
    revocation_reason = p_reason
  WHERE id = p_key_id;

  -- Log the revocation in PHI audit log
  INSERT INTO phi_audit_log (
    business_id,
    user_id,
    event_type,
    resource_type,
    resource_id,
    action,
    metadata
  ) VALUES (
    v_business_id,
    p_user_id,
    'phi_modify',
    'encryption_key',
    p_key_id,
    'revoke_encryption_key',
    jsonb_build_object(
      'key_id', p_key_id,
      'key_version', v_key_version,
      'reason', p_reason
    )
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION revoke_encryption_key IS 'Revoke an encryption key (mark as invalid)';

-- ============================================
-- Trigger to ensure only one active key per business
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_active_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If inserting/updating to active, deactivate other keys for this business
  IF NEW.is_active = true THEN
    UPDATE encryption_keys
    SET is_active = false, status = 'rotated', rotated_at = now()
    WHERE business_id = NEW.business_id
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_single_active_key
  BEFORE INSERT OR UPDATE ON encryption_keys
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_key();

-- ============================================
-- Add foreign key from compliance_settings to encryption_keys
-- ============================================
DO $$
BEGIN
  -- Check if the column exists and add FK constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_settings'
    AND column_name = 'encryption_key_id'
  ) THEN
    -- The column exists as text, we reference the encryption_keys by storing the UUID as text
    -- This is intentional as the encryption.ts code stores key IDs this way
    NULL; -- No action needed, the text column works with UUID::text lookups
  END IF;
END $$;
