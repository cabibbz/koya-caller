/**
 * Admin Export Customers API Route
 * Export customer data as CSV
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

    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        created_at,
        minutes_used_this_cycle,
        minutes_included,
        plans (name, price_cents),
        users (email, phone)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    // Build CSV
    const headers = ["ID", "Business Name", "Email", "Phone", "Status", "Plan", "Price", "Minutes Used", "Minutes Included", "Created At"];
    const rows = (businesses || []).map((b: any) => [
      b.id,
      `"${(b.name || "").replace(/"/g, '""')}"`,
      b.users?.email || "",
      b.users?.phone || "",
      b.subscription_status,
      b.plans?.name || "",
      b.plans?.price_cents ? (b.plans.price_cents / 100).toFixed(2) : "",
      b.minutes_used_this_cycle || 0,
      b.minutes_included || 0,
      b.created_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    // Log audit
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "export.download",
      target_type: "customers",
      details: { count: businesses?.length },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="koya-customers-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
