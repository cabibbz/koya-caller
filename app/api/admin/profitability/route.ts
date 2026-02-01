/**
 * Admin Profitability API Route
 *
 * Returns per-business profitability data including:
 * - Revenue (subscription + overage)
 * - Costs (Retell + Twilio + overhead)
 * - Profit and margin
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface ProfitabilityRow {
  business_id: string;
  business_name: string;
  subscription_status: string;
  plan_name: string | null;
  current_cycle_start: string | null;
  current_cycle_end: string | null;
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
  subscription_cents: number;
  overage_revenue_cents: number;
  total_revenue_cents: number;
  total_cost_cents: number;
  profit_cents: number;
  margin_percent: number;
  retell_cost_cents: number;
  twilio_cost_cents: number;
}

interface ProfitabilitySummary {
  total_businesses: number;
  profitable_businesses: number;
  unprofitable_businesses: number;
  total_revenue_cents: number;
  total_cost_cents: number;
  total_profit_cents: number;
  avg_margin_percent: number;
  total_minutes_used: number;
}

/**
 * GET /api/admin/profitability
 *
 * Query params:
 * - sort: "profit" | "revenue" | "margin" | "usage" (default: profit)
 * - order: "asc" | "desc" (default: desc)
 * - status: "all" | "profitable" | "unprofitable" (default: all)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") || "profit";
    const order = searchParams.get("order") || "desc";
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = supabase as any;

    // Get summary stats
    const { data: summaryData, error: summaryError } = await adminSupabase.rpc(
      "get_profitability_summary"
    );

    let summary: ProfitabilitySummary = {
      total_businesses: 0,
      profitable_businesses: 0,
      unprofitable_businesses: 0,
      total_revenue_cents: 0,
      total_cost_cents: 0,
      total_profit_cents: 0,
      avg_margin_percent: 0,
      total_minutes_used: 0,
    };

    if (!summaryError && summaryData && summaryData.length > 0) {
      summary = summaryData[0];
    }

    // Get per-business data from view
    let query = adminSupabase
      .from("business_profitability")
      .select("*");

    // Filter by profitability status
    if (status === "profitable") {
      query = query.gte("profit_cents", 0);
    } else if (status === "unprofitable") {
      query = query.lt("profit_cents", 0);
    }

    // Sort
    const sortColumn = {
      profit: "profit_cents",
      revenue: "total_revenue_cents",
      margin: "margin_percent",
      usage: "minutes_used",
      name: "business_name",
    }[sort] || "profit_cents";

    query = query.order(sortColumn, { ascending: order === "asc" });

    // Paginate
    query = query.range(offset, offset + limit - 1);

    const { data: businesses, error: bizError } = await query;

    if (bizError) {
      // View might not exist yet - fall back to manual calculation
      if (bizError.code === "42P01") {
        return NextResponse.json({
          error: "Profitability view not found. Please run migration 20250131000005.",
          hint: "Run the migration to create the business_profitability view",
        }, { status: 500 });
      }

      logError("Admin Profitability GET", bizError);
      return NextResponse.json(
        { error: "Failed to fetch profitability data" },
        { status: 500 }
      );
    }

    // Get cost rates for display
    const { data: settings } = await adminSupabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["retell_cost_per_minute_cents", "twilio_cost_per_minute_cents", "platform_overhead_percent"]);

    const costRates = {
      retell_cents: 10,
      twilio_cents: 2,
      overhead_percent: 10,
    };

    if (settings) {
      for (const s of settings) {
        if (s.key === "retell_cost_per_minute_cents") costRates.retell_cents = parseInt(s.value, 10);
        if (s.key === "twilio_cost_per_minute_cents") costRates.twilio_cents = parseInt(s.value, 10);
        if (s.key === "platform_overhead_percent") costRates.overhead_percent = parseInt(s.value, 10);
      }
    }

    // Format response
    const formattedBusinesses = (businesses || []).map((b: ProfitabilityRow) => ({
      id: b.business_id,
      name: b.business_name,
      status: b.subscription_status,
      plan: b.plan_name,
      cycleStart: b.current_cycle_start,
      cycleEnd: b.current_cycle_end,

      // Usage
      minutesUsed: b.minutes_used,
      minutesIncluded: b.minutes_included,
      overageMinutes: b.overage_minutes,

      // Revenue (formatted)
      subscriptionDollars: (b.subscription_cents / 100).toFixed(2),
      overageRevenueDollars: (b.overage_revenue_cents / 100).toFixed(2),
      totalRevenueDollars: (b.total_revenue_cents / 100).toFixed(2),

      // Costs (formatted)
      retellCostDollars: (b.retell_cost_cents / 100).toFixed(2),
      twilioCostDollars: (b.twilio_cost_cents / 100).toFixed(2),
      totalCostDollars: (b.total_cost_cents / 100).toFixed(2),

      // Profit (formatted)
      profitDollars: (b.profit_cents / 100).toFixed(2),
      marginPercent: b.margin_percent,
      isProfitable: b.profit_cents >= 0,

      // Raw cents for calculations
      _raw: {
        subscriptionCents: b.subscription_cents,
        overageRevenueCents: b.overage_revenue_cents,
        totalRevenueCents: b.total_revenue_cents,
        totalCostCents: b.total_cost_cents,
        profitCents: b.profit_cents,
      },
    }));

    return NextResponse.json({
      summary: {
        totalBusinesses: summary.total_businesses,
        profitableBusinesses: summary.profitable_businesses,
        unprofitableBusinesses: summary.unprofitable_businesses,
        totalRevenueDollars: (Number(summary.total_revenue_cents) / 100).toFixed(2),
        totalCostDollars: (Number(summary.total_cost_cents) / 100).toFixed(2),
        totalProfitDollars: (Number(summary.total_profit_cents) / 100).toFixed(2),
        avgMarginPercent: summary.avg_margin_percent,
        totalMinutesUsed: summary.total_minutes_used,
      },
      costRates: {
        retellCentsPerMinute: costRates.retell_cents,
        twilioCentsPerMinute: costRates.twilio_cents,
        overheadPercent: costRates.overhead_percent,
        totalCentsPerMinute: Math.round(
          (costRates.retell_cents + costRates.twilio_cents) * (1 + costRates.overhead_percent / 100)
        ),
      },
      businesses: formattedBusinesses,
      pagination: {
        limit,
        offset,
        total: summary.total_businesses,
      },
    });
  } catch (error) {
    logError("Admin Profitability GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/profitability
 *
 * Update cost rates
 * Body: { retellCents?: number, twilioCents?: number, overheadPercent?: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { retellCents, twilioCents, overheadPercent } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = supabase as any;

    const updates: Array<{ key: string; value: string }> = [];

    if (typeof retellCents === "number" && retellCents >= 0) {
      updates.push({ key: "retell_cost_per_minute_cents", value: String(retellCents) });
    }
    if (typeof twilioCents === "number" && twilioCents >= 0) {
      updates.push({ key: "twilio_cost_per_minute_cents", value: String(twilioCents) });
    }
    if (typeof overheadPercent === "number" && overheadPercent >= 0) {
      updates.push({ key: "platform_overhead_percent", value: String(overheadPercent) });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
    }

    for (const update of updates) {
      await adminSupabase
        .from("site_settings")
        .upsert(update, { onConflict: "key" });
    }

    return NextResponse.json({
      success: true,
      updated: updates.map(u => u.key),
    });
  } catch (error) {
    logError("Admin Profitability PUT", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
