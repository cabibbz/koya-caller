-- Fix missing columns in caller_profiles table
-- Add call_count if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'call_count'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN call_count INT DEFAULT 1;
  END IF;
END $$;

-- Add last_call_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'last_call_at'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN last_call_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Add vip_status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'vip_status'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN vip_status BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add notes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'notes'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
