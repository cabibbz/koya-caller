/**
 * Admin Announcements API Route
 * CRUD for system announcements
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: announcements, error } = await (supabase as any)
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ announcements: [] });
    }

    return NextResponse.json({ announcements: announcements || [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, type, target_audience, expires_at } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    const { data: announcement, error } = await (supabase as any)
      .from("announcements")
      .insert({
        title,
        content,
        type: type || "info",
        target_audience: target_audience || "all",
        expires_at: expires_at || null,
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }

    // Log audit
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "announcement.create",
      target_type: "announcement",
      target_id: announcement.id,
      target_name: title,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
