/**
 * Admin Blog API - List Posts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient() as any;

    const { data: posts, error } = await adminClient
      .from("blog_posts")
      .select("id, title, slug, status, published_at, view_count, category, target_keyword, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
