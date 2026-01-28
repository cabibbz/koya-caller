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
      logError("Admin Health", callsError);
      // Continue with partial data - calls metrics will be empty/zero
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

    // Churn risk thresholds
    const HIGH_RISK_DAYS = 14;
    const MEDIUM_RISK_DAYS = 7;
    const HIGH_FAILURE_RATE = 0.2; // 20%
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Planned threshold
    const DECLINING_USAGE_THRESHOLD = 0.5; // 50% drop

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const healthMetrics = (businesses || []).map((b: any) => {
      const metrics = callMetrics[b.id] || { total: 0, failed: 0, lastCall: null };
      const lastActivity = metrics.lastCall || new Date(b.updated_at);
      const daysSinceLastCall = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate failure rate
      const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;

      // Calculate usage ratio
      const usageRatio =
        b.minutes_included > 0
          ? b.minutes_used_this_cycle / b.minutes_included
          : 0;

      // Collect churn risk factors for detailed analysis
      const churnRiskFactors: string[] = [];

      // Factor 1: Inactivity
      if (daysSinceLastCall > HIGH_RISK_DAYS) {
        churnRiskFactors.push(`No calls for ${daysSinceLastCall} days`);
      } else if (daysSinceLastCall > MEDIUM_RISK_DAYS) {
        churnRiskFactors.push(`Low activity (${daysSinceLastCall} days since last call)`);
      }

      // Factor 2: High failure rate (needs at least 5 calls to be meaningful)
      if (metrics.total >= 5 && failureRate > HIGH_FAILURE_RATE) {
        churnRiskFactors.push(`High call failure rate (${Math.round(failureRate * 100)}%)`);
      }

      // Factor 3: Very low usage
      if (usageRatio < 0.1 && daysSinceLastCall > 5) {
        churnRiskFactors.push("Very low minutes usage (<10%)");
      }

      // Factor 4: Paused subscription
      if (b.subscription_status === "paused") {
        churnRiskFactors.push("Subscription paused");
      }

      // Calculate churn risk level based on factors
      let churnRisk: "low" | "medium" | "high" | "churned";
      let churnRiskScore = 0;

      if (b.subscription_status === "cancelled") {
        churnRisk = "churned";
      } else {
        // Score-based risk assessment
        if (daysSinceLastCall > HIGH_RISK_DAYS) churnRiskScore += 3;
        else if (daysSinceLastCall > MEDIUM_RISK_DAYS) churnRiskScore += 1;

        if (b.subscription_status === "paused") churnRiskScore += 3;

        if (metrics.total >= 5 && failureRate > HIGH_FAILURE_RATE) churnRiskScore += 2;
        if (metrics.total >= 5 && failureRate > 0.3) churnRiskScore += 1; // Extra for very high failure

        if (usageRatio < 0.1 && daysSinceLastCall > 5) churnRiskScore += 1;

        if (churnRiskScore >= 3) {
          churnRisk = "high";
          highRiskCount++;
        } else if (churnRiskScore >= 1) {
          churnRisk = "medium";
          mediumRiskCount++;
        } else {
          churnRisk = "low";
        }
      }

      // Calculate upsell opportunity
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
        usage_percent: Math.round(usageRatio * 100),
        churn_risk: churnRisk,
        churn_risk_score: churnRiskScore,
        churn_risk_factors: churnRiskFactors,
        upsell_candidate: upsellCandidate,
        total_calls: metrics.total,
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

    // Count calendar sync failures
    // Includes: expired tokens and appointments with sync errors
    let syncFailures = 0;

    // Check for expired calendar tokens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: expiredTokens } = await (supabase as any)
      .from("calendar_integrations")
      .select("id")
      .lt("token_expires_at", now.toISOString())
      .neq("provider", "built_in");

    syncFailures += (expiredTokens || []).length;

    // Check for appointments with sync errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: syncErrors } = await (supabase as any)
      .from("appointments")
      .select("id")
      .not("calendar_sync_error", "is", null)
      .eq("calendar_sync_status", "failed");

    syncFailures += (syncErrors || []).length;

    return NextResponse.json({
      businesses: healthMetrics,
      summary: {
        high_risk_count: highRiskCount,
        medium_risk_count: mediumRiskCount,
        upsell_opportunities: upsellOpportunities,
        failed_calls_today: failedCallsToday,
        sync_failures: syncFailures,
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
