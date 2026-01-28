-- Add slug column to businesses for public booking URLs
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill existing businesses with a slug derived from name
-- Uses lowercase name with spaces replaced by hyphens, limited to alphanumeric + hyphens
UPDATE businesses
  SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
  WHERE slug IS NULL;

-- Add unique index for fast slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug) WHERE slug IS NOT NULL;
