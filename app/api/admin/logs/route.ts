/**
 * Admin System Logs API Route
 * Get system errors and events
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try to get logs from system_logs table, fall back to generating from calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: logs, error: _error } = await (supabase as any)
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    // If no system_logs table or empty, generate from failed calls
    let formattedLogs = logs || [];

    if (!logs || logs.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: failedCalls } = await (supabase as any)
        .from("calls")
        .select("id, business_id, status, created_at, error_message, businesses(name)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(50);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
      formattedLogs = (failedCalls || []).map((call: any) => ({
        id: call.id,
        level: "error",
        category: "retell",
        message: call.error_message || "Call failed",
        details: null,
        business_id: call.business_id,
        business_name: call.businesses?.name,
        call_id: call.id,
        created_at: call.created_at,
      }));
    }

    // Calculate stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Log response filtering
    const errorsToday = formattedLogs.filter(
      (l: any) => l.level === "error" && new Date(l.created_at) >= todayStart
    ).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Log response filtering
    const warningsToday = formattedLogs.filter(
      (l: any) => l.level === "warning" && new Date(l.created_at) >= todayStart
    ).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Log response filtering
    const errorsThisWeek = formattedLogs.filter(
      (l: any) => l.level === "error" && new Date(l.created_at) >= weekStart
    ).length;

    // Count by category
    const categoryCounts: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Log response iteration
    formattedLogs.forEach((l: any) => {
      categoryCounts[l.category] = (categoryCounts[l.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      logs: formattedLogs,
      stats: {
        errors_today: errorsToday,
        warnings_today: warningsToday,
        errors_this_week: errorsThisWeek,
        top_categories: topCategories,
      },
    });
  } catch (error) {
    logError("Admin Logs GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
