/**
 * Admin Change Plan API Route
 * Change a business's subscription plan
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

    const { businessId, planId } = body;

    // Validate businessId is a valid UUID
    if (!businessId || typeof businessId !== "string" || !UUID_REGEX.test(businessId)) {
      return NextResponse.json({ error: "Invalid business ID format" }, { status: 400 });
    }

    // Validate planId is a valid UUID
    if (!planId || typeof planId !== "string" || !UUID_REGEX.test(planId)) {
      return NextResponse.json({ error: "Invalid plan ID format" }, { status: 400 });
    }

    // Get new plan details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: plan } = await (supabase as any)
      .from("plans")
      .select("id, name, included_minutes")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get business name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single();

    // Update plan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error } = await (supabase as any)
      .from("businesses")
      .update({
        plan_id: planId,
        minutes_included: plan.included_minutes,
      })
      .eq("id", businessId);

    if (error) {
      logError("Admin Subscription Plan POST", error);
      return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
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
    logError("Admin Subscription Plan POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
