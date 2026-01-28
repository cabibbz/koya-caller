/**
 * Schema Markup Generator
 * Generates JSON-LD structured data for SEO rich snippets
 */

import {
  APP_CONFIG,
  getProductionUrl,
  getLogoUrl,
} from "@/lib/config";

export interface BlogPostSchema {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  meta_description: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  lsi_keywords: string[] | null;
  published_at: string | null;
  updated_at: string;
  schema_type: 'Article' | 'HowTo' | 'FAQ' | 'NewsArticle' | 'BlogPosting';
  faq_items: Array<{ question: string; answer: string }> | null;
  table_of_contents: Array<{ id: string; text: string; level: number }> | null;
}

const SITE_URL = getProductionUrl();
const SITE_NAME = APP_CONFIG.fullName;
const LOGO_URL = getLogoUrl();

/**
 * Generate Article schema (default for blog posts)
 */
export function generateArticleSchema(post: BlogPostSchema): object {
  const wordCount = post.content?.split(/\s+/).length || 0;

  return {
    '@context': 'https://schema.org',
    '@type': post.schema_type === 'NewsArticle' ? 'NewsArticle' : 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: post.featured_image_url ? {
      '@type': 'ImageObject',
      url: post.featured_image_url,
      caption: post.featured_image_alt || post.title,
    } : undefined,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
    },
    datePublished: post.published_at,
    dateModified: post.updated_at,
    wordCount: wordCount,
    keywords: post.lsi_keywords?.join(', '),
    articleSection: post.category,
    inLanguage: 'en-US',
  };
}

/**
 * Generate FAQ schema for posts with Q&A content
 */
export function generateFAQSchema(faqItems: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Generate HowTo schema for tutorial/guide posts
 */
export function generateHowToSchema(
  post: BlogPostSchema,
  steps: Array<{ name: string; text: string; image?: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: post.title,
    description: post.meta_description || post.excerpt,
    image: post.featured_image_url,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image,
    })),
  };
}

/**
 * Generate Breadcrumb schema
 */
export function generateBreadcrumbSchema(
  post: BlogPostSchema,
  clusterName?: string
): object {
  const items = [
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
  ];

  if (clusterName) {
    items.push({ name: clusterName, url: `${SITE_URL}/blog/topic/${post.slug}` });
  }

  if (post.category) {
    items.push({ name: post.category, url: `${SITE_URL}/blog?category=${encodeURIComponent(post.category)}` });
  }

  items.push({ name: post.title, url: `${SITE_URL}/blog/${post.slug}` });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate Organization schema (for author/publisher)
 */
export function generateOrganizationSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    sameAs: [
      'https://twitter.com/koyacaller',
      'https://linkedin.com/company/koyacaller',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-800-KOYA',
      contactType: 'customer service',
    },
  };
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebSiteSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Extract FAQ items from markdown content
 */
export function extractFAQFromContent(content: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];

  // Look for Q&A patterns in content
  // Pattern 1: **Q: Question?** followed by answer
  const qPattern = /\*\*Q:\s*(.+?\?)\*\*\s*\n+(.+?)(?=\n\n|\*\*Q:|$)/gi;
  let match;
  while ((match = qPattern.exec(content)) !== null) {
    faqs.push({
      question: match[1].trim(),
      answer: match[2].trim().replace(/^\*\*A:\s*\*\*\s*/i, ''),
    });
  }

  // Pattern 2: ### Question? followed by answer paragraph
  const headingPattern = /###\s*(.+?\?)\s*\n+([^#]+?)(?=\n###|\n##|$)/gi;
  while ((match = headingPattern.exec(content)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim().split('\n\n')[0]; // First paragraph only
    if (!faqs.some(f => f.question === question)) {
      faqs.push({ question, answer });
    }
  }

  return faqs.slice(0, 10); // Limit to 10 FAQs
}

/**
 * Extract HowTo steps from markdown content
 */
export function extractHowToSteps(content: string): Array<{ name: string; text: string }> {
  const steps: Array<{ name: string; text: string }> = [];

  // Pattern: numbered steps like "1. **Step Name**" or "## Step 1: Name"
  const numberedPattern = /(?:^|\n)(?:\d+\.\s*\*\*(.+?)\*\*|##\s*Step\s*\d+[:\s]*(.+?))\s*\n+([^#\d]+?)(?=\n\d+\.|\n##|$)/gi;

  let match;
  while ((match = numberedPattern.exec(content)) !== null) {
    const name = (match[1] || match[2] || '').trim();
    const text = match[3].trim().split('\n\n')[0];
    if (name && text) {
      steps.push({ name, text });
    }
  }

  return steps;
}

/**
 * Generate table of contents from markdown headings
 */
export function generateTableOfContents(content: string): Array<{ id: string; text: string; level: number }> {
  const toc: Array<{ id: string; text: string; level: number }> = [];

  const headingPattern = /^(#{2,4})\s+(.+)$/gm;
  let match;

  while ((match = headingPattern.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    toc.push({ id, text, level });
  }

  return toc;
}

/**
 * Generate all applicable schemas for a blog post
 */
export function generateAllSchemas(post: BlogPostSchema, clusterName?: string): string {
  const schemas: object[] = [];

  // Always include article schema
  schemas.push(generateArticleSchema(post));

  // Always include breadcrumb
  schemas.push(generateBreadcrumbSchema(post, clusterName));

  // Add FAQ schema if post has FAQ items
  if (post.faq_items && post.faq_items.length > 0) {
    schemas.push(generateFAQSchema(post.faq_items));
  } else {
    // Try to extract FAQs from content
    const extractedFaqs = extractFAQFromContent(post.content);
    if (extractedFaqs.length > 0) {
      schemas.push(generateFAQSchema(extractedFaqs));
    }
  }

  // Add HowTo schema for tutorial posts
  if (post.schema_type === 'HowTo') {
    const steps = extractHowToSteps(post.content);
    if (steps.length > 0) {
      schemas.push(generateHowToSchema(post, steps));
    }
  }

  return JSON.stringify(schemas, null, 2);
}

/**
 * Determine best schema type based on content
 */
export function detectSchemaType(title: string, content: string): 'Article' | 'HowTo' | 'FAQ' | 'BlogPosting' {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Check for HowTo indicators
  if (
    lowerTitle.includes('how to') ||
    lowerTitle.includes('guide') ||
    lowerTitle.includes('tutorial') ||
    lowerTitle.includes('step by step') ||
    lowerTitle.includes('steps to')
  ) {
    return 'HowTo';
  }

  // Check for FAQ indicators
  if (
    lowerTitle.includes('faq') ||
    lowerTitle.includes('questions') ||
    lowerContent.includes('**q:') ||
    (content.match(/\?/g) || []).length > 5
  ) {
    return 'FAQ';
  }

  // Default to BlogPosting for general content
  return 'BlogPosting';
}
