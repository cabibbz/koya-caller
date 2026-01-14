/**
 * Admin Subscription Action API Route
 * Pause, resume, or cancel subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { businessId, action } = body;

    // Validate businessId is a valid UUID
    if (!businessId || typeof businessId !== "string" || !UUID_REGEX.test(businessId)) {
      return NextResponse.json({ error: "Invalid business ID format" }, { status: 400 });
    }

    // Validate action is one of allowed values
    const validActions = ["pause", "resume", "cancel"] as const;
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be: pause, resume, or cancel" }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      pause: "paused",
      resume: "active",
      cancel: "cancelled",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error } = await (supabase as any)
      .from("businesses")
      .update({ subscription_status: statusMap[action] })
      .eq("id", businessId);

    if (error) {
      logError("Admin Subscription Action POST", error);
      return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: `subscription.${action}`,
      target_type: "business",
      target_id: businessId,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Admin Subscription Action POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
