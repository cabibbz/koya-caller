/**
 * Individual Blog Post Page
 * SEO-optimized with dynamic metadata and schema markup
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, ArrowRight, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  type BlogPostSchema,
} from "@/lib/schema-markup";
import { getProductionUrl } from "@/lib/config";

export const revalidate = 3600; // Revalidate every hour

interface BlogPostPageProps {
  params: { slug: string };
}

async function getBlogPost(slug: string) {
  const supabase = createAdminClient() as any;

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  return post;
}

async function getClusterInfo(clusterId: string | null) {
  if (!clusterId) return null;

  const supabase = createAdminClient() as any;

  const { data: cluster } = await supabase
    .from("blog_clusters")
    .select("name, slug")
    .eq("id", clusterId)
    .single();

  return cluster;
}

async function getRelatedPosts(currentSlug: string, category: string | null, clusterId: string | null) {
  const supabase = createAdminClient() as any;

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, published_at, featured_image_url")
    .eq("status", "published")
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);

  // Prioritize same cluster
  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  } else if (category) {
    query = query.eq("category", category);
  }

  const { data: posts } = await query;
  return posts || [];
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPost(params.slug);

  if (!post) {
    return {
      title: "Post Not Found | Koya Caller Blog",
    };
  }

  const siteUrl = getProductionUrl();

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    keywords: post.lsi_keywords?.join(", "),
    authors: [{ name: "Koya Caller" }],
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      type: "article",
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      section: post.category,
      tags: post.lsi_keywords,
      images: post.featured_image_url
        ? [
            {
              url: post.featured_image_url,
              width: 1200,
              height: 630,
              alt: post.featured_image_alt || post.title,
            },
          ]
        : undefined,
      url: `${siteUrl}/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
    },
    alternates: {
      canonical: `${siteUrl}/blog/${post.slug}`,
    },
  };
}

// Generate static paths for popular posts
export async function generateStaticParams() {
  // Skip static generation if Supabase is not configured (build time)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  try {
    const supabase = createAdminClient() as any;

    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .limit(50);

    return (posts || []).map((post: any) => ({
      slug: post.slug,
    }));
  } catch {
    // Return empty array if database is unavailable
    return [];
  }
}

// Increment view count
async function incrementViewCount(postId: string) {
  const supabase = createAdminClient() as any;
  await supabase.rpc("increment_blog_views", { post_id: postId }).catch(() => {
    // Silently fail if function doesn't exist
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  // Increment view count (fire and forget)
  incrementViewCount(post.id);

  const [clusterInfo, relatedPosts] = await Promise.all([
    getClusterInfo(post.cluster_id),
    getRelatedPosts(params.slug, post.category, post.cluster_id),
  ]);

  // Estimate read time
  const wordCount = post.content?.split(/\s+/).length || 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Generate schema markup
  const articleSchema = generateArticleSchema(post as BlogPostSchema);
  const breadcrumbSchema = generateBreadcrumbSchema(post as BlogPostSchema, clusterInfo?.name);
  const faqSchema = post.faq_items?.length > 0 ? generateFAQSchema(post.faq_items) : null;

  // Combine all schemas
  const schemas = [articleSchema, breadcrumbSchema];
  if (faqSchema) schemas.push(faqSchema);

  return (
    <>
      {/* Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemas),
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <nav className="border-b bg-muted/30" aria-label="Breadcrumb">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <ol className="flex items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <ChevronRight className="w-4 h-4" />
              <li>
                <Link href="/blog" className="hover:text-foreground transition-colors">
                  Blog
                </Link>
              </li>
              {post.category && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <li>
                    <Link
                      href={`/blog?category=${encodeURIComponent(post.category)}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {post.category}
                    </Link>
                  </li>
                </>
              )}
              <ChevronRight className="w-4 h-4" />
              <li className="text-foreground font-medium truncate max-w-[200px]">
                {post.title}
              </li>
            </ol>
          </div>
        </nav>

        {/* Header */}
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </div>
        </header>

        {/* Article */}
        <article className="max-w-4xl mx-auto px-6 py-12" itemScope itemType="https://schema.org/Article">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {post.category && (
              <Badge variant="secondary" itemProp="articleSection">
                {post.category}
              </Badge>
            )}
            {post.published_at && (
              <time
                dateTime={post.published_at}
                itemProp="datePublished"
                className="text-sm text-muted-foreground flex items-center gap-1"
              >
                <Calendar className="w-4 h-4" />
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {readTime} min read
            </span>
            <span className="text-sm text-muted-foreground">
              {wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" itemProp="headline">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed" itemProp="description">
              {post.excerpt}
            </p>
          )}

          {/* Featured Image */}
          {post.featured_image_url && (
            <figure className="aspect-video bg-muted rounded-xl overflow-hidden mb-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                className="w-full h-full object-cover"
                itemProp="image"
              />
            </figure>
          )}

          {/* Table of Contents */}
          {post.table_of_contents && post.table_of_contents.length > 3 && (
            <nav className="bg-muted/50 rounded-xl p-6 mb-10">
              <h2 className="font-semibold mb-4">Table of Contents</h2>
              <ul className="space-y-2">
                {post.table_of_contents.map((item: any) => (
                  <li
                    key={item.id}
                    style={{ paddingLeft: `${(item.level - 2) * 16}px` }}
                  >
                    <a
                      href={`#${item.id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none" itemProp="articleBody">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold mt-10 mb-4">{children}</h1>
                ),
                h2: ({ children }) => {
                  const id = String(children)
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-");
                  return (
                    <h2 id={id} className="text-2xl font-bold mt-8 mb-4 scroll-mt-20">
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const id = String(children)
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-");
                  return (
                    <h3 id={id} className="text-xl font-semibold mt-6 mb-3 scroll-mt-20">
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-muted-foreground">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-muted-foreground">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic my-6 text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary underline hover:no-underline"
                    target={href?.startsWith("http") ? "_blank" : undefined}
                    rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {post.content || ""}
            </ReactMarkdown>
          </div>

          {/* FAQ Section */}
          {post.faq_items && post.faq_items.length > 0 && (
            <section className="mt-12 pt-8 border-t">
              <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
              <div className="space-y-6">
                {post.faq_items.map((faq: any, i: number) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {post.lsi_keywords && post.lsi_keywords.length > 0 && (
            <div className="mt-10 pt-6 border-t">
              <p className="text-sm text-muted-foreground mb-3">Related Topics:</p>
              <div className="flex flex-wrap gap-2">
                {post.lsi_keywords.map((keyword: string) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="border-t bg-muted/30">
            <div className="max-w-4xl mx-auto px-6 py-12">
              <h2 className="text-2xl font-bold mb-6">
                {clusterInfo ? `More in ${clusterInfo.name}` : "Related Articles"}
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((related: any) => (
                  <Link key={related.id} href={`/blog/${related.slug}`}>
                    <article className="bg-background rounded-lg overflow-hidden hover:shadow-md transition-shadow h-full">
                      {related.featured_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={related.featured_image_url}
                          alt=""
                          className="w-full h-32 object-cover"
                        />
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold mb-2 line-clamp-2 hover:text-primary transition-colors">
                          {related.title}
                        </h3>
                        {related.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {related.excerpt}
                          </p>
                        )}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t bg-primary/5">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-3xl font-bold mb-4">Never Miss a Call Again</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Let Koya answer your business calls 24/7 with AI that sounds just like a real
              receptionist.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
