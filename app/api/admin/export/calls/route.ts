/**
 * Admin Export Calls API Route
 * Export call data as CSV
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
    const { data: calls, error } = await (supabase as any)
      .from("calls")
      .select(`
        id,
        caller_phone,
        status,
        duration_seconds,
        created_at,
        businesses (name)
      `)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) {
      logError("Admin Export Calls GET", error);
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    // Build CSV
    const headers = ["ID", "Business", "Caller Phone", "Status", "Duration (seconds)", "Created At"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const rows = (calls || []).map((c: any) => [
      c.id,
      `"${(c.businesses?.name || "").replace(/"/g, '""')}"`,
      c.caller_phone || "",
      c.status,
      c.duration_seconds || 0,
      c.created_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    // Log audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "export.download",
      target_type: "calls",
      details: { count: calls?.length },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="koya-calls-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logError("Admin Export Calls GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
