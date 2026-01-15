-- Migration: Topic Clusters for SEO
-- Implements pillar/cluster content strategy

-- ============================================
-- Topic Clusters Table
-- ============================================
CREATE TABLE blog_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Cluster info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Target keyword for the cluster
  target_keyword TEXT NOT NULL,

  -- Pillar post (main hub article)
  pillar_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,

  -- SEO metadata for cluster page
  meta_title TEXT,
  meta_description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Cluster Posts Junction Table
-- ============================================
CREATE TABLE blog_cluster_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID NOT NULL REFERENCES blog_clusters(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,

  -- Order within cluster
  sort_order INT DEFAULT 0,

  -- Is this the pillar post?
  is_pillar BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cluster_id, post_id)
);

-- ============================================
-- Add cluster reference to blog_posts
-- ============================================
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES blog_clusters(id) ON DELETE SET NULL;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_pillar BOOLEAN DEFAULT FALSE;

-- Add internal links tracking
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS internal_links JSONB DEFAULT '[]';
-- Stores: [{"post_id": "uuid", "anchor_text": "text", "url": "/blog/slug"}]

-- Add schema type for structured data
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Article'
  CHECK (schema_type IN ('Article', 'HowTo', 'FAQ', 'NewsArticle', 'BlogPosting'));

-- Add FAQ data for FAQ schema
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS faq_items JSONB DEFAULT '[]';
-- Stores: [{"question": "...", "answer": "..."}]

-- Add table of contents
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS table_of_contents JSONB DEFAULT '[]';
-- Stores: [{"id": "heading-id", "text": "Heading Text", "level": 2}]

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_blog_clusters_slug ON blog_clusters(slug);
CREATE INDEX idx_blog_clusters_keyword ON blog_clusters(target_keyword);
CREATE INDEX idx_blog_cluster_posts_cluster ON blog_cluster_posts(cluster_id);
CREATE INDEX idx_blog_cluster_posts_post ON blog_cluster_posts(post_id);
CREATE INDEX idx_blog_posts_cluster ON blog_posts(cluster_id);

-- ============================================
-- Auto-update updated_at
-- ============================================
CREATE TRIGGER update_blog_clusters_updated_at
  BEFORE UPDATE ON blog_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE blog_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_cluster_posts ENABLE ROW LEVEL SECURITY;

-- Clusters - public can view active, service role can manage
CREATE POLICY "Public can view active clusters" ON blog_clusters
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Service role bypass blog_clusters" ON blog_clusters
  FOR ALL USING (auth.role() = 'service_role');

-- Cluster posts - public can view, service role can manage
CREATE POLICY "Public can view cluster posts" ON blog_cluster_posts
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role bypass blog_cluster_posts" ON blog_cluster_posts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to auto-generate internal links
-- ============================================
CREATE OR REPLACE FUNCTION suggest_internal_links(p_post_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
  post_id UUID,
  title TEXT,
  slug TEXT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH current_post AS (
    SELECT
      bp.id,
      bp.target_keyword,
      bp.category,
      bp.cluster_id,
      bp.lsi_keywords
    FROM blog_posts bp
    WHERE bp.id = p_post_id
  )
  SELECT
    bp.id as post_id,
    bp.title,
    bp.slug,
    (
      CASE WHEN bp.cluster_id = cp.cluster_id AND cp.cluster_id IS NOT NULL THEN 0.5 ELSE 0 END +
      CASE WHEN bp.category = cp.category AND cp.category IS NOT NULL THEN 0.3 ELSE 0 END +
      CASE WHEN bp.target_keyword = cp.target_keyword THEN 0.2 ELSE 0 END
    )::FLOAT as relevance_score
  FROM blog_posts bp, current_post cp
  WHERE bp.id != p_post_id
    AND bp.status = 'published'
  ORDER BY relevance_score DESC, bp.view_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
