/**
 * Admin Announcements API Route
 * CRUD for system announcements
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { success, created, errors } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errors.unauthorized();
    }
    if (user.app_metadata?.is_admin !== true) {
      return errors.forbidden();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: announcements, error } = await (supabase as any)
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return success({ announcements: [] });
    }

    return success({ announcements: announcements || [] });
  } catch (error) {
    logError("Admin Announcements GET", error);
    return errors.internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errors.unauthorized();
    }
    if (user.app_metadata?.is_admin !== true) {
      return errors.forbidden();
    }

    const body = await request.json();
    const { title, content, type, target_audience, expires_at } = body;

    if (!title || !content) {
      return errors.badRequest("Title and content required");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
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
      logError("Admin Announcements POST", error);
      return errors.internalError("Failed to create announcement");
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "announcement.create",
      target_type: "announcement",
      target_id: announcement.id,
      target_name: title,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return created({ announcement });
  } catch (error) {
    logError("Admin Announcements POST", error);
    return errors.internalError();
  }
}
