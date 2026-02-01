/**
 * AI Blog Generation API - Enhanced SEO
 * Generates perfectly SEO-optimized blog posts using Claude
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { detectSchemaType, generateTableOfContents, extractFAQFromContent } from "@/lib/schema-markup";
import { withAIGenerationRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface GenerationConfig {
  tone: string;
  length: string;
  seo_focus: string;
  content_type: string;
}

const LENGTH_WORDS: Record<string, number> = {
  short: 800,
  medium: 1500,
  long: 2500,
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "formal, business-appropriate, and authoritative while remaining accessible",
  casual: "friendly, conversational, and approachable with a warm tone",
  authoritative: "expert, confident, data-driven, and well-researched",
  helpful: "supportive, instructive, empathetic, and solution-focused",
  witty: "clever, engaging, with appropriate humor while staying informative",
  technical: "precise, detailed, technically accurate with clear explanations",
};

const CONTENT_TYPE_INSTRUCTIONS: Record<string, string> = {
  article: `Write a comprehensive article with:
- A compelling introduction that hooks readers and states the value proposition
- 4-6 major sections with H2 headings
- 2-3 subsections per major section with H3 headings
- Expert insights and actionable takeaways
- A conclusion that summarizes key points and includes a clear CTA`,

  tutorial: `Write a step-by-step how-to guide with:
- Introduction explaining what readers will learn and why it matters
- Prerequisites section if applicable
- Numbered steps with clear H2 headings (e.g., "## Step 1: Setup Your Account")
- Tips and warnings in callout format
- Troubleshooting section
- Summary of what was accomplished`,

  listicle: `Write a list-based article with:
- Engaging introduction with the promise of what readers will discover
- 7-15 numbered items with H2 headings
- Each item has 100-200 words of explanation
- Practical examples for each item
- Conclusion with next steps`,

  news: `Write a news-style article with:
- Inverted pyramid structure (most important info first)
- Who, what, when, where, why, how in the opening
- Expert quotes or data points
- Context and background
- Implications and what's next`,

  insight: `Write a thought leadership piece with:
- Bold thesis statement in the introduction
- Industry analysis with data and trends
- Original perspective and predictions
- Counter-arguments addressed
- Strategic recommendations
- Forward-looking conclusion`,
};

const SEO_INSTRUCTIONS = `
## CRITICAL SEO REQUIREMENTS - Follow these EXACTLY:

### Title Optimization (Most Important)
- Title MUST be 50-60 characters
- Put the PRIMARY KEYWORD at the BEGINNING of the title
- Use power words: Ultimate, Complete, Essential, Proven, Best
- Include the current year if relevant (2025)
- Format: "[Keyword]: [Benefit/Promise]" or "How to [Keyword]: [Result]"

### Meta Description (Second Most Important)
- EXACTLY 150-160 characters
- Include primary keyword in first 60 characters
- Include a clear value proposition
- End with a subtle CTA (Learn more, Discover, Find out)
- Must be compelling and click-worthy

### Content Structure for SEO
1. **First Paragraph (Critical)**
   - Include primary keyword in the FIRST SENTENCE
   - State the main benefit/value within first 100 words
   - Hook the reader immediately

2. **Heading Structure**
   - H2 headings every 200-300 words
   - Include keyword variations in at least 50% of H2s
   - H3 subheadings for detailed sections
   - Never skip heading levels (H2 → H3, not H2 → H4)

3. **Keyword Optimization**
   - Primary keyword density: 1-2% (natural, not forced)
   - Use LSI keywords throughout (at least 5-7 related terms)
   - Include keyword in at least one H2 heading
   - Use keyword variations and synonyms

4. **Content Depth Signals**
   - Include statistics and data points
   - Add expert quotes or citations
   - Create comprehensive coverage (answer all related questions)
   - Include "People Also Ask" style sections

5. **Internal Linking Opportunities**
   - Mark 3-5 places for internal links with [INTERNAL_LINK: topic]
   - Use descriptive anchor text suggestions

6. **Featured Snippet Optimization**
   - Include a clear definition/answer early for "what is" queries
   - Use numbered lists for "how to" queries
   - Create comparison tables when relevant
   - Add FAQ section with Q&A format

7. **Readability (Affects Rankings)**
   - Short paragraphs (2-4 sentences max)
   - Bullet points for lists
   - Bold key terms and takeaways
   - Reading level: 8th grade (accessible but authoritative)
`;

const JSON_FORMAT = `
{
  "title": "Keyword-optimized title (50-60 chars)",
  "meta_title": "SEO title for search results (max 60 chars)",
  "meta_description": "Compelling meta description (150-160 chars exactly)",
  "excerpt": "2-3 sentence summary for previews and social sharing",
  "content": "Full article in Markdown with proper H2/H3 structure",
  "slug": "keyword-focused-url-slug",
  "target_keyword": "primary target keyword",
  "lsi_keywords": ["lsi keyword 1", "lsi keyword 2", "etc - minimum 7"],
  "category": "appropriate category",
  "schema_type": "Article|HowTo|FAQ|BlogPosting",
  "faq_items": [
    {"question": "Common question 1?", "answer": "Comprehensive answer..."},
    {"question": "Common question 2?", "answer": "Comprehensive answer..."}
  ],
  "internal_link_suggestions": [
    {"anchor_text": "suggested anchor", "topic": "related topic for linking"}
  ]
}`;

async function handlePost(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting is now handled by withAIGenerationRateLimit wrapper

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const { topic, targetKeyword, config, clusterId } = body as {
      topic: string;
      targetKeyword?: string;
      config: GenerationConfig;
      clusterId?: string;
    };

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const wordCount = LENGTH_WORDS[config.length] || 1500;
    const toneDesc = TONE_DESCRIPTIONS[config.tone] || TONE_DESCRIPTIONS.professional;
    const contentInstructions = CONTENT_TYPE_INSTRUCTIONS[config.content_type] || CONTENT_TYPE_INSTRUCTIONS.article;

    // Build comprehensive SEO-focused prompt
    const systemPrompt = `You are an elite SEO content writer with 15+ years of experience ranking content on page 1 of Google. You understand E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) and how to write content that satisfies both users and search engines.

Your writing style is ${toneDesc}.

${SEO_INSTRUCTIONS}

${contentInstructions}

IMPORTANT CONTEXT:
- You are writing for Koya Caller, an AI phone answering service for small businesses
- Always tie topics back to how AI phone systems help businesses when relevant
- Focus on providing genuine value while naturally incorporating keywords
- Write content that would earn backlinks and social shares

Return ONLY valid JSON in this exact format:
${JSON_FORMAT}`;

    const userPrompt = `Write a perfectly SEO-optimized ${config.content_type} about: "${topic}"

${targetKeyword ? `PRIMARY TARGET KEYWORD: "${targetKeyword}" - This MUST appear in title, meta, first paragraph, and at least 2 H2 headings` : ""}

Requirements:
- Word count: Approximately ${wordCount} words (THIS IS IMPORTANT - do not go under)
- SEO focus level: ${config.seo_focus === "high" ? "MAXIMUM - Target high-volume competitive keywords, comprehensive coverage" : config.seo_focus === "low" ? "Long-tail keywords, answer specific user intent" : "Balanced approach with moderate competition keywords"}
- Include at least 7 LSI (semantically related) keywords naturally throughout
- Add 3-5 FAQ items that people commonly search for
- Mark internal linking opportunities
- Create content worthy of featured snippets
- Ensure every section provides actionable value

Content must be:
✓ Comprehensive (cover all aspects of the topic)
✓ Original (unique angles and insights)
✓ Actionable (readers can apply what they learn)
✓ Well-structured (clear hierarchy and flow)
✓ Scannable (headers, bullets, bold text)

The goal is PAGE 1 RANKINGS. Write accordingly.

Return ONLY valid JSON, no other text.`;


    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        { role: "user", content: userPrompt }
      ],
      system: systemPrompt,
    });

    // Extract text from response
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // Parse JSON response
    let articleData;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        articleData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (_parseError) {
      throw new Error("Failed to parse AI response");
    }

    // Post-process content for SEO enhancements
    const processedContent = articleData.content;

    // Generate table of contents
    const tableOfContents = generateTableOfContents(processedContent);

    // Extract FAQs if not provided
    const faqItems = articleData.faq_items?.length > 0
      ? articleData.faq_items
      : extractFAQFromContent(processedContent);

    // Detect best schema type
    const schemaType = articleData.schema_type || detectSchemaType(articleData.title, processedContent);

    // Save to database
    const adminClient = createAdminClient() as any;

    // Generate unique slug
    let slug = articleData.slug || generateSlug(articleData.title);
    const { data: existingSlug } = await adminClient
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const { data: post, error: insertError } = await adminClient
      .from("blog_posts")
      .insert({
        title: articleData.title,
        slug,
        excerpt: articleData.excerpt,
        content: processedContent,
        meta_title: articleData.meta_title,
        meta_description: articleData.meta_description,
        target_keyword: articleData.target_keyword || targetKeyword || null,
        lsi_keywords: articleData.lsi_keywords || [],
        category: articleData.category || "General",
        status: "draft",
        schema_type: schemaType,
        faq_items: faqItems,
        table_of_contents: tableOfContents,
        internal_links: articleData.internal_link_suggestions || [],
        cluster_id: clusterId || null,
        generation_config: config,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error("Failed to save article");
    }

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        status: post.status,
        target_keyword: post.target_keyword,
        schema_type: post.schema_type,
        seo_score: calculateQuickSEOScore(post),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Quick SEO score based on key factors
function calculateQuickSEOScore(post: any): number {
  let score = 0;

  // Title optimization (20 points)
  const titleLength = post.title?.length || 0;
  if (titleLength >= 50 && titleLength <= 60) score += 20;
  else if (titleLength >= 40 && titleLength <= 70) score += 15;
  else if (titleLength > 0) score += 5;

  // Meta description (20 points)
  const metaLength = post.meta_description?.length || 0;
  if (metaLength >= 150 && metaLength <= 160) score += 20;
  else if (metaLength >= 120 && metaLength <= 170) score += 15;
  else if (metaLength > 0) score += 5;

  // Target keyword exists (15 points)
  if (post.target_keyword) score += 15;

  // LSI keywords (15 points)
  const lsiCount = post.lsi_keywords?.length || 0;
  if (lsiCount >= 7) score += 15;
  else if (lsiCount >= 5) score += 10;
  else if (lsiCount >= 3) score += 5;

  // Content length (15 points)
  const wordCount = post.content?.split(/\s+/).length || 0;
  if (wordCount >= 1500) score += 15;
  else if (wordCount >= 1000) score += 10;
  else if (wordCount >= 500) score += 5;

  // FAQ items (10 points)
  if (post.faq_items?.length >= 3) score += 10;
  else if (post.faq_items?.length >= 1) score += 5;

  // Table of contents (5 points)
  if (post.table_of_contents?.length >= 3) score += 5;

  return Math.min(100, score);
}

// Export with AI generation rate limiting (10 requests per minute per user)
export const POST = withAIGenerationRateLimit(handlePost);
