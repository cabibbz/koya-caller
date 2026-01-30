-- Migration: Add missing index on calls.created_at
-- Date: 2025-01-26
--
-- Most dashboard queries filter calls by business_id and created_at,
-- but only started_at had an index. This adds the commonly-used created_at index.

-- Index for filtering calls by business and created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_calls_business_created
ON calls(business_id, created_at DESC);

-- Note: Trigram indexes for text search require pg_trgm extension.
-- If you need full-text search optimization, enable the extension first:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Then create these indexes:
-- CREATE INDEX IF NOT EXISTS idx_calls_summary_trgm ON calls USING gin (summary gin_trgm_ops) WHERE summary IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_calls_message_trgm ON calls USING gin (message_taken gin_trgm_ops) WHERE message_taken IS NOT NULL;

COMMENT ON INDEX idx_calls_business_created IS 'Primary index for time-based call queries on dashboard';
