/**
 * Admin Apply Credit API Route
 * Add minutes credit to a business
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maximum minutes that can be credited in a single request (safety limit)
const MAX_CREDIT_MINUTES = 10000;

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

    const { businessId, minutes } = body;

    // Validate businessId is a valid UUID
    if (!businessId || typeof businessId !== "string" || !UUID_REGEX.test(businessId)) {
      return NextResponse.json({ error: "Invalid business ID format" }, { status: 400 });
    }

    // Validate minutes is a positive number within limits
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "Minutes must be a positive number" }, { status: 400 });
    }

    if (minutes > MAX_CREDIT_MINUTES) {
      return NextResponse.json({ error: `Cannot credit more than ${MAX_CREDIT_MINUTES} minutes at once` }, { status: 400 });
    }

    // Round to whole number
    const creditMinutes = Math.floor(minutes);

    // Get current business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("minutes_included, name")
      .eq("id", businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Add credit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error } = await (supabase as any)
      .from("businesses")
      .update({ minutes_included: (business.minutes_included || 0) + creditMinutes })
      .eq("id", businessId);

    if (error) {
      logError("Admin Subscription Credit POST", error);
      return NextResponse.json({ error: "Failed to apply credit" }, { status: 500 });
    }

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "credit.apply",
      target_type: "business",
      target_id: businessId,
      target_name: business.name,
      details: { minutes_added: creditMinutes },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Admin Subscription Credit POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
