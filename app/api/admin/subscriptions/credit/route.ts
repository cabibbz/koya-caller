/**
 * Admin Apply Credit API Route
 * Add minutes credit to a business
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
    const { businessId, minutes } = body;

    if (!businessId || typeof minutes !== "number" || minutes <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get current business
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("minutes_included, name")
      .eq("id", businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Add credit
    const { error } = await (supabase as any)
      .from("businesses")
      .update({ minutes_included: (business.minutes_included || 0) + minutes })
      .eq("id", businessId);

    if (error) {
      return NextResponse.json({ error: "Failed to apply credit" }, { status: 500 });
    }

    // Log audit
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "credit.apply",
      target_type: "business",
      target_id: businessId,
      target_name: business.name,
      details: { minutes_added: minutes },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
