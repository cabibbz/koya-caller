/**
 * Admin Audit Log API Route
 * Get admin action history
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

    const { data: logs, error } = await (supabase as any)
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      // Table might not exist yet, return empty
      console.error("[Admin Audit API] Error:", error);
      return NextResponse.json({ logs: [] });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error("[Admin Audit API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
