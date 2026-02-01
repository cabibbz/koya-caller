-- Migration: Add VIP status and notes to caller_profiles
-- Feature: Customer/Contact Management (PRODUCT_ROADMAP.md Section 2.3)

-- Add vip_status column
ALTER TABLE caller_profiles
ADD COLUMN IF NOT EXISTS vip_status BOOLEAN NOT NULL DEFAULT FALSE;

-- Add notes column
ALTER TABLE caller_profiles
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for VIP status filtering
CREATE INDEX IF NOT EXISTS idx_caller_profiles_vip_status
ON caller_profiles(business_id, vip_status)
WHERE vip_status = TRUE;

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_caller_profiles_search
ON caller_profiles(business_id, name, email, phone_number);

-- Create index for sorting by last contact
CREATE INDEX IF NOT EXISTS idx_caller_profiles_last_call
ON caller_profiles(business_id, last_call_at DESC);

-- Add RLS policy for contacts access (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'caller_profiles'
        AND policyname = 'Business users can manage their contacts'
    ) THEN
        CREATE POLICY "Business users can manage their contacts"
        ON caller_profiles
        FOR ALL
        USING (
            business_id IN (
                SELECT id FROM businesses
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            business_id IN (
                SELECT id FROM businesses
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Comment on columns
COMMENT ON COLUMN caller_profiles.vip_status IS 'Whether this contact is marked as a VIP for priority service';
COMMENT ON COLUMN caller_profiles.notes IS 'User notes about this contact';
