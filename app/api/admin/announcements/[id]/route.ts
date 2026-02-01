/**
 * Admin Announcement By ID API Route
 * Update or delete announcements
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error } = await (supabase as any)
      .from("announcements")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      logError("Admin Announcement PUT", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "announcement.update",
      target_type: "announcement",
      target_id: id,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Admin Announcement PUT", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error } = await (supabase as any)
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      logError("Admin Announcement DELETE", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "announcement.delete",
      target_type: "announcement",
      target_id: id,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Admin Announcement DELETE", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
