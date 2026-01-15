-- Migration: Add responsiveness settings for Retell AI
-- Features: Interruption sensitivity and response speed
-- These settings control how quickly Koya stops talking when the caller speaks
-- and how fast Koya responds after the caller finishes speaking

-- ============================================================================
-- call_settings table additions
-- ============================================================================

-- Interruption Sensitivity: How sensitive to caller interruptions (0-1)
-- Higher values = stops faster when caller starts speaking
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS interruption_sensitivity numeric(3,2) DEFAULT 0.9;

-- Responsiveness: How quickly to respond after caller stops speaking (0-1)
-- Higher values = responds faster
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS responsiveness numeric(3,2) DEFAULT 0.9;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate interruption sensitivity is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_interruption_sensitivity;
ALTER TABLE call_settings ADD CONSTRAINT valid_interruption_sensitivity
CHECK (interruption_sensitivity >= 0 AND interruption_sensitivity <= 1);

-- Validate responsiveness is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_responsiveness;
ALTER TABLE call_settings ADD CONSTRAINT valid_responsiveness
CHECK (responsiveness >= 0 AND responsiveness <= 1);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN call_settings.interruption_sensitivity IS 'How sensitive to caller interruptions (0-1). Higher = stops faster when caller speaks. Default 0.9 for highly responsive behavior.';
COMMENT ON COLUMN call_settings.responsiveness IS 'How quickly to respond after caller stops speaking (0-1). Higher = responds faster. Default 0.9 for highly responsive behavior.';
