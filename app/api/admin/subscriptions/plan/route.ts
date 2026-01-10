/**
 * Admin Change Plan API Route
 * Change a business's subscription plan
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { businessId, planId } = body;

    if (!businessId || !planId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get new plan details
    const { data: plan } = await (supabase as any)
      .from("plans")
      .select("id, name, included_minutes")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get business name
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single();

    // Update plan
    const { error } = await (supabase as any)
      .from("businesses")
      .update({
        plan_id: planId,
        minutes_included: plan.included_minutes,
      })
      .eq("id", businessId);

    if (error) {
      console.error("[Admin Change Plan] Error:", error);
      return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
    }

    // Log audit
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "plan.change",
      target_type: "business",
      target_id: businessId,
      target_name: business?.name,
      details: { new_plan: plan.name },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Change Plan] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
