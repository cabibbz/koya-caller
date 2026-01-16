/**
 * Admin Blog API - Individual Post Operations
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET - Fetch single post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: post, error } = await adminClient
      .from("blog_posts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

// Whitelist of allowed fields for blog post updates
const ALLOWED_BLOG_UPDATE_FIELDS = [
  "title",
  "slug",
  "content",
  "excerpt",
  "meta_description",
  "category",
  "target_keyword",
  "featured_image",
  "status",
  "tags",
  "author",
  "published_at",
] as const;

// PATCH - Update post
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json();

    // Only allow whitelisted fields to prevent mass assignment
    const sanitizedUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of ALLOWED_BLOG_UPDATE_FIELDS) {
      if (field in body && body[field] !== undefined) {
        sanitizedUpdate[field] = body[field];
      }
    }

    const adminClient = createAdminClient() as any;

    const { data: post, error } = await adminClient
      .from("blog_posts")
      .update(sanitizedUpdate)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, post });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

// DELETE - Delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { error } = await adminClient
      .from("blog_posts")
      .delete()
      .eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
