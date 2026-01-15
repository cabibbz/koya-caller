/**
 * Admin Export Revenue API Route
 * Export revenue data as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        created_at,
        plans (name, price_cents)
      `)
      .eq("subscription_status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      logError("Admin Export Revenue GET", error);
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    // Build CSV
    const headers = ["Business ID", "Business Name", "Plan", "Monthly Revenue ($)", "Status", "Customer Since"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const rows = (businesses || []).map((b: any) => [
      b.id,
      `"${(b.name || "").replace(/"/g, '""')}"`,
      b.plans?.name || "",
      b.plans?.price_cents ? (b.plans.price_cents / 100).toFixed(2) : "0.00",
      b.subscription_status,
      b.created_at,
    ]);

    // Add total row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response accumulator
    const totalRevenue = (businesses || []).reduce((sum: number, b: any) => sum + (b.plans?.price_cents || 0), 0);
    rows.push(["", "TOTAL", "", (totalRevenue / 100).toFixed(2), "", ""]);

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "export.download",
      target_type: "revenue",
      details: { count: businesses?.length, total_mrr: totalRevenue },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="koya-revenue-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logError("Admin Export Revenue GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
