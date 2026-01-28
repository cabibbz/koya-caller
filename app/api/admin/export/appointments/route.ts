/**
 * Admin Export Appointments API Route
 * Export appointment data as CSV
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
    const { data: appointments, error } = await (supabase as any)
      .from("appointments")
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        service_name,
        scheduled_at,
        duration_minutes,
        status,
        created_at,
        businesses (name)
      `)
      .order("scheduled_at", { ascending: false })
      .limit(10000);

    if (error) {
      logError("Admin Export Appointments GET", error);
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    // Build CSV
    const headers = ["ID", "Business", "Customer Name", "Phone", "Email", "Service", "Scheduled At", "Duration", "Status", "Created At"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const rows = (appointments || []).map((a: any) => [
      a.id,
      `"${(a.businesses?.name || "").replace(/"/g, '""')}"`,
      `"${(a.customer_name || "").replace(/"/g, '""')}"`,
      a.customer_phone || "",
      a.customer_email || "",
      `"${(a.service_name || "").replace(/"/g, '""')}"`,
      a.scheduled_at,
      a.duration_minutes || 60,
      a.status,
      a.created_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "export.download",
      target_type: "appointments",
      details: { count: appointments?.length },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="koya-appointments-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logError("Admin Export Appointments GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
