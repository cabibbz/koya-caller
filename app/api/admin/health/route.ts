/**
 * Admin Health API Route
 * Part 8: Admin Dashboard - Health Monitoring
 *
 * Returns churn risk indicators, upsell opportunities, and failure metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

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

    // Check admin status from app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all businesses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error: bizError } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        updated_at,
        minutes_used_this_cycle,
        minutes_included
      `)
      .in("subscription_status", ["active", "paused", "cancelled"]);

    if (bizError) {
      logError("Admin Health GET - businesses", bizError);
      return NextResponse.json(
        { error: "Failed to fetch business data" },
        { status: 500 }
      );
    }

    // Fetch all calls for health metrics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const businessIds = (businesses || []).map((b: any) => b.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calls, error: callsError } = await (supabase as any)
      .from("calls")
      .select("business_id, status, created_at")
      .in("business_id", businessIds);

    if (callsError) {
      // Error handled silently
    }

    // Calculate call metrics per business
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const callMetrics: Record<
      string,
      { total: number; failed: number; lastCall: Date | null }
    > = {};

    let failedCallsToday = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (calls || []).forEach((call: any) => {
      if (!callMetrics[call.business_id]) {
        callMetrics[call.business_id] = { total: 0, failed: 0, lastCall: null };
      }

      callMetrics[call.business_id].total++;

      if (call.status === "failed") {
        callMetrics[call.business_id].failed++;
        if (new Date(call.created_at) >= todayStart) {
          failedCallsToday++;
        }
      }

      const callDate = new Date(call.created_at);
      if (
        !callMetrics[call.business_id].lastCall ||
        callDate > callMetrics[call.business_id].lastCall!
      ) {
        callMetrics[call.business_id].lastCall = callDate;
      }
    });

    // Calculate health metrics for each business
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let upsellOpportunities = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const healthMetrics = (businesses || []).map((b: any) => {
      const metrics = callMetrics[b.id] || { total: 0, failed: 0, lastCall: null };
      const lastActivity = metrics.lastCall || new Date(b.updated_at);
      const daysSinceLastCall = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate churn risk
      let churnRisk: "low" | "medium" | "high" | "churned";
      if (b.subscription_status === "cancelled") {
        churnRisk = "churned";
      } else if (b.subscription_status === "paused" || daysSinceLastCall > 14) {
        churnRisk = "high";
        highRiskCount++;
      } else if (daysSinceLastCall > 7) {
        churnRisk = "medium";
        mediumRiskCount++;
      } else {
        churnRisk = "low";
      }

      // Calculate upsell opportunity
      const usageRatio =
        b.minutes_included > 0
          ? b.minutes_used_this_cycle / b.minutes_included
          : 0;
      const upsellCandidate = usageRatio > 0.8;
      if (upsellCandidate) upsellOpportunities++;

      // Calculate failed call percent
      const failedCallPercent =
        metrics.total > 0
          ? Math.round((metrics.failed / metrics.total) * 100 * 10) / 10
          : 0;

      return {
        business_id: b.id,
        business_name: b.name,
        subscription_status: b.subscription_status,
        last_activity: lastActivity.toISOString(),
        days_since_last_call: daysSinceLastCall,
        minutes_used_this_cycle: b.minutes_used_this_cycle || 0,
        minutes_included: b.minutes_included || 1, // Prevent division by zero
        churn_risk: churnRisk,
        upsell_candidate: upsellCandidate,
        failed_call_percent: failedCallPercent,
      };
    });

    // Sort by risk level (high first, then medium)
    healthMetrics.sort((a: { churn_risk: string }, b: { churn_risk: string }) => {
      const riskOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
        churned: 3,
      };
      return (riskOrder[a.churn_risk] || 4) - (riskOrder[b.churn_risk] || 4);
    });

    return NextResponse.json({
      businesses: healthMetrics,
      summary: {
        high_risk_count: highRiskCount,
        medium_risk_count: mediumRiskCount,
        upsell_opportunities: upsellOpportunities,
        failed_calls_today: failedCallsToday,
        sync_failures: 0, // TODO: Implement calendar sync failure tracking
      },
    });
  } catch (error) {
    logError("Admin Health GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
