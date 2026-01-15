-- Add missing industry column to businesses table
-- This column stores the business type/industry for AI context

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS industry TEXT;

-- Add comment for documentation
COMMENT ON COLUMN businesses.industry IS 'Business industry/type used for AI prompt customization';
