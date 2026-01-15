-- Migration: Fix calls table and call_settings table missing columns
-- Date: 2025-01-09
--
-- This migration adds missing columns that the application code expects:
-- 1. calls.flagged - boolean for flagging important calls
-- 2. calls.notes - text for user notes on calls
-- 3. call_settings.after_hours_action - controls after-hours call routing

-- =============================================================================
-- FIX #1: Add missing columns to calls table
-- =============================================================================

-- Add flagged column for marking important calls
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

-- Add notes column for user annotations
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS notes text;

-- Add index for filtering flagged calls
CREATE INDEX IF NOT EXISTS idx_calls_flagged
ON calls(business_id, flagged)
WHERE flagged = true;

-- =============================================================================
-- FIX #2: Add missing after_hours_action column to call_settings
-- =============================================================================

-- Add after_hours_action column
-- Values: 'voicemail' (default), 'ai', 'transfer'
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS after_hours_action text DEFAULT 'ai';

-- Add comment explaining the column
COMMENT ON COLUMN call_settings.after_hours_action IS
'Action to take for after-hours calls: voicemail, ai, or transfer';

-- =============================================================================
-- FIX #3: Add missing recording_enabled column to call_settings
-- =============================================================================

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT true;

-- =============================================================================
-- FIX #4: Ensure calls table has proper indexes for dashboard queries
-- =============================================================================

-- Index for fetching recent calls by business
CREATE INDEX IF NOT EXISTS idx_calls_business_started
ON calls(business_id, started_at DESC);

-- Index for filtering by outcome
CREATE INDEX IF NOT EXISTS idx_calls_business_outcome
ON calls(business_id, outcome);

-- Index for searching by phone number
CREATE INDEX IF NOT EXISTS idx_calls_from_number
ON calls(from_number);

-- =============================================================================
-- Update any existing null values to defaults
-- =============================================================================

UPDATE calls SET flagged = false WHERE flagged IS NULL;
UPDATE call_settings SET after_hours_action = 'ai' WHERE after_hours_action IS NULL;
UPDATE call_settings SET recording_enabled = true WHERE recording_enabled IS NULL;
