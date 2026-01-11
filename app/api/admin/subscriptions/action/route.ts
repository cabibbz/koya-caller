/**
 * Admin Subscription Action API Route
 * Pause, resume, or cancel subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { businessId, action } = body;

    if (!businessId || !["pause", "resume", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      pause: "paused",
      resume: "active",
      cancel: "cancelled",
    };

    const { error } = await (supabase as any)
      .from("businesses")
      .update({ subscription_status: statusMap[action] })
      .eq("id", businessId);

    if (error) {
      return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }

    // Log audit
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
