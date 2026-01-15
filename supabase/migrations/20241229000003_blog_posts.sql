-- Migration: AI Auto-Blog Feature
-- Supports SEO-optimized blog post generation and management

-- ============================================
-- Blog Posts Table
-- ============================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,

  -- SEO Metadata
  meta_title TEXT,
  meta_description TEXT,
  target_keyword TEXT,
  lsi_keywords TEXT[],

  -- Media
  featured_image_url TEXT,
  featured_image_alt TEXT,

  -- Categorization
  category TEXT,
  tags TEXT[],

  -- Status & Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,

  -- Generation Settings (saved for regeneration)
  generation_config JSONB DEFAULT '{}',
  -- Stores: tone, length, seo_focus, content_type, etc.

  -- Analytics
  view_count INT DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);

-- Auto-update updated_at
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Blog Generation Queue
-- ============================================
CREATE TABLE blog_generation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Generation Request
  topic TEXT NOT NULL,
  target_keyword TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  -- Config includes: tone, length, seo_focus, content_type, include_images, etc.

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,

  -- Result
  blog_post_id UUID REFERENCES blog_posts(id),

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_blog_queue_status ON blog_generation_queue(status);

-- ============================================
-- Blog Presets (saved configurations)
-- ============================================
CREATE TABLE blog_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default presets
INSERT INTO blog_presets (name, description, config, is_default) VALUES
(
  'SEO Article',
  'Long-form SEO-optimized article for organic traffic',
  '{"tone": "professional", "length": "long", "seo_focus": "high", "content_type": "article", "include_images": true}',
  true
),
(
  'Quick Update',
  'Short news-style update for frequent posting',
  '{"tone": "casual", "length": "short", "seo_focus": "medium", "content_type": "news", "include_images": false}',
  false
),
(
  'How-To Guide',
  'Step-by-step tutorial with clear instructions',
  '{"tone": "helpful", "length": "medium", "seo_focus": "high", "content_type": "tutorial", "include_images": true}',
  false
),
(
  'Industry Insights',
  'Thought leadership content for authority building',
  '{"tone": "authoritative", "length": "long", "seo_focus": "medium", "content_type": "insight", "include_images": true}',
  false
);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_presets ENABLE ROW LEVEL SECURITY;

-- Blog posts - public can read published, admins can manage all
CREATE POLICY "Public can view published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Service role bypass blog_posts" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Queue - service role only
CREATE POLICY "Service role bypass blog_queue" ON blog_generation_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Presets - public read, service role write
CREATE POLICY "Public can view presets" ON blog_presets
  FOR SELECT USING (true);

CREATE POLICY "Service role bypass blog_presets" ON blog_presets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Helper function to generate slug
-- ============================================
CREATE OR REPLACE FUNCTION generate_blog_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to increment view count
-- ============================================
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
