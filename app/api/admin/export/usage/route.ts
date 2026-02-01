/**
 * Admin Export Usage API Route
 * Export usage data as CSV
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
        minutes_used_this_cycle,
        minutes_included,
        current_cycle_start,
        current_cycle_end,
        plans (name)
      `)
      .order("minutes_used_this_cycle", { ascending: false });

    if (error) {
      logError("Admin Export Usage GET", error);
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    // Build CSV
    const headers = ["Business ID", "Business Name", "Plan", "Status", "Minutes Used", "Minutes Included", "Usage %", "Overage", "Cycle Start", "Cycle End"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const rows = (businesses || []).map((b: any) => {
      const used = b.minutes_used_this_cycle || 0;
      const included = b.minutes_included || 0;
      const usagePercent = included > 0 ? ((used / included) * 100).toFixed(1) : "0.0";
      const overage = Math.max(0, used - included);

      return [
        b.id,
        `"${(b.name || "").replace(/"/g, '""')}"`,
        b.plans?.name || "",
        b.subscription_status,
        used,
        included,
        usagePercent,
        overage,
        b.current_cycle_start || "",
        b.current_cycle_end || "",
      ];
    });

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "export.download",
      target_type: "usage",
      details: { count: businesses?.length },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="koya-usage-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logError("Admin Export Usage GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
