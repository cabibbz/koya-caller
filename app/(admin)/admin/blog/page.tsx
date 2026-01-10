/**
 * Admin Blog Management Page
 * AI Auto-Blog with bubble-based configuration UI
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BlogManagementClient } from "./blog-client";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin status
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch existing blog posts
  const { data: posts } = await (supabase as any)
    .from("blog_posts")
    .select("id, title, slug, status, published_at, view_count, category, target_keyword, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch presets
  const { data: presets } = await (supabase as any)
    .from("blog_presets")
    .select("*")
    .order("is_default", { ascending: false });

  return (
    <BlogManagementClient
      initialPosts={posts || []}
      presets={presets || []}
    />
  );
}
