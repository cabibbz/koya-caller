/**
 * Admin Usage API Route
 * Part 8: Admin Dashboard - Usage & Costs
 *
 * Returns total calls, minutes, estimated costs, and margins
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Cost estimates per minute (in cents)
const RETELL_COST_PER_MINUTE_CENTS = 10; // $0.10/min estimate
const TWILIO_COST_PER_MINUTE_CENTS = 2; // $0.02/min estimate

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status from app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calls, error: callsError } = await (supabase as any)
      .from("calls")
      .select("id, status, duration_seconds, created_at, business_id");

    if (callsError) {
      logError("Admin Usage GET - calls", callsError);
      return NextResponse.json(
        { error: "Failed to fetch usage data" },
        { status: 500 }
      );
    }

    // Fetch all businesses with plans for revenue calculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error: bizError } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        minutes_used_this_cycle,
        minutes_included,
        plan_id,
        plans (
          name,
          price_cents
        )
      `);

    if (bizError) {
      logError("Admin Usage GET - businesses", bizError);
      return NextResponse.json(
        { error: "Failed to fetch business data" },
        { status: 500 }
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate call stats
    let totalCalls = 0;
    let completedCalls = 0;
    let failedCalls = 0;
    let totalSeconds = 0;
    let callsToday = 0;
    let callsThisWeek = 0;
    let callsThisMonth = 0;

    const callsByBusiness: Record<string, { total: number; minutes: number }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (calls || []).forEach((call: any) => {
      totalCalls++;
      const seconds = call.duration_seconds || 0;
      totalSeconds += seconds;

      if (call.status === "completed") completedCalls++;
      if (call.status === "failed") failedCalls++;

      const createdAt = new Date(call.created_at);
      if (createdAt >= todayStart) callsToday++;
      if (createdAt >= weekStart) callsThisWeek++;
      if (createdAt >= monthStart) callsThisMonth++;

      if (!callsByBusiness[call.business_id]) {
        callsByBusiness[call.business_id] = { total: 0, minutes: 0 };
      }
      callsByBusiness[call.business_id].total++;
      callsByBusiness[call.business_id].minutes += Math.ceil(seconds / 60);
    });

    const totalMinutes = Math.ceil(totalSeconds / 60);
    const avgDuration = totalCalls > 0 ? Math.round(totalSeconds / totalCalls) : 0;

    // Calculate costs and revenue
    const retellCostCents = totalMinutes * RETELL_COST_PER_MINUTE_CENTS;
    const twilioCostCents = totalMinutes * TWILIO_COST_PER_MINUTE_CENTS;
    const totalCostCents = retellCostCents + twilioCostCents;

    // Calculate revenue from active subscriptions
    let revenueCents = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (businesses || []).forEach((b: any) => {
      if (b.subscription_status === "active" && b.plans?.price_cents) {
        revenueCents += b.plans.price_cents;
      }
    });

    const marginPercent =
      revenueCents > 0
        ? Math.round(((revenueCents - totalCostCents) / revenueCents) * 100 * 10) / 10
        : 0;

    // Format per-business usage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const businessUsage = (businesses || []).map((b: any) => ({
      business_id: b.id,
      business_name: b.name,
      plan_name: b.plans?.name || null,
      total_calls: callsByBusiness[b.id]?.total || 0,
      total_minutes: callsByBusiness[b.id]?.minutes || 0,
      minutes_used_this_cycle: b.minutes_used_this_cycle || 0,
      minutes_included: b.minutes_included || 0,
      usage_percent:
        b.minutes_included > 0
          ? Math.round((b.minutes_used_this_cycle / b.minutes_included) * 100 * 10) / 10
          : 0,
    }));

    return NextResponse.json({
      stats: {
        total_calls: totalCalls,
        total_minutes: totalMinutes,
        completed_calls: completedCalls,
        failed_calls: failedCalls,
        avg_call_duration_seconds: avgDuration,
        calls_today: callsToday,
        calls_this_week: callsThisWeek,
        calls_this_month: callsThisMonth,
      },
      costs: {
        retell_cost_cents: retellCostCents,
        twilio_cost_cents: twilioCostCents,
        total_cost_cents: totalCostCents,
        revenue_cents: revenueCents,
        margin_percent: marginPercent,
      },
      businesses: businessUsage,
    });
  } catch (error) {
    logError("Admin Usage GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
