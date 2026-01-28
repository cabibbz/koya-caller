/**
 * Admin Financials API Route
 * Part 8: Admin Dashboard - Financials
 *
 * Returns MRR, ARPU, customer counts, growth metrics, call success rates,
 * churn risk indicators, customer lifetime value, and feature adoption rates
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Churn risk thresholds
const CHURN_RISK_HIGH_DAYS = 14;
const CHURN_RISK_MEDIUM_DAYS = 7;
const HIGH_FAILURE_RATE_THRESHOLD = 0.2; // 20% failure rate

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

    // Fetch all businesses with their plans
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        subscription_status,
        created_at,
        updated_at,
        plan_id,
        minutes_used_this_cycle,
        minutes_included,
        onboarding_completed_at,
        plans (
          price_cents
        )
      `);

    if (error) {
      logError("Admin Financials GET", error);
      return NextResponse.json(
        { error: "Failed to fetch financial data" },
        { status: 500 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all business IDs for call metrics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const businessIds = (businesses || []).map((b: any) => b.id);

    // Fetch calls for all businesses (last 90 days for better metrics)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calls } = await (supabase as any)
      .from("calls")
      .select("business_id, status, outcome, created_at")
      .in("business_id", businessIds)
      .gte("created_at", ninetyDaysAgo.toISOString());

    // Fetch AI configs for feature adoption
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: aiConfigs } = await (supabase as any)
      .from("ai_config")
      .select("business_id, spanish_enabled, upsells_enabled, bundles_enabled, packages_enabled, memberships_enabled")
      .in("business_id", businessIds);

    // Fetch calendar integrations for feature adoption
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calendarIntegrations } = await (supabase as any)
      .from("calendar_integrations")
      .select("business_id, provider")
      .in("business_id", businessIds)
      .neq("provider", "built_in");

    // Fetch webhooks for feature adoption
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: webhooks } = await (supabase as any)
      .from("webhooks")
      .select("business_id")
      .in("business_id", businessIds)
      .eq("is_active", true);

    // Build call metrics per business
    const callMetrics: Record<string, { total: number; failed: number; lastCall: Date | null }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (calls || []).forEach((call: any) => {
      if (!callMetrics[call.business_id]) {
        callMetrics[call.business_id] = { total: 0, failed: 0, lastCall: null };
      }
      callMetrics[call.business_id].total++;
      if (call.status === "failed" || call.outcome === "missed") {
        callMetrics[call.business_id].failed++;
      }
      const callDate = new Date(call.created_at);
      if (!callMetrics[call.business_id].lastCall || callDate > callMetrics[call.business_id].lastCall!) {
        callMetrics[call.business_id].lastCall = callDate;
      }
    });

    // Build feature adoption maps
    const aiConfigMap = new Map<string, { spanish: boolean; upsells: boolean; bundles: boolean; packages: boolean; memberships: boolean }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (aiConfigs || []).forEach((cfg: any) => {
      aiConfigMap.set(cfg.business_id, {
        spanish: cfg.spanish_enabled || false,
        upsells: cfg.upsells_enabled || false,
        bundles: cfg.bundles_enabled || false,
        packages: cfg.packages_enabled || false,
        memberships: cfg.memberships_enabled || false,
      });
    });

    const calendarSet = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (calendarIntegrations || []).forEach((cal: any) => {
      calendarSet.add(cal.business_id);
    });

    const webhookSet = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (webhooks || []).forEach((wh: any) => {
      webhookSet.add(wh.business_id);
    });

    // Calculate metrics
    let totalMrrCents = 0;
    let activeCustomers = 0;
    let churnedCustomers = 0;
    let newCustomers30d = 0;
    let churnedCustomers30d = 0;

    // Enhanced metrics
    let totalCalls = 0;
    let totalFailedCalls = 0;
    let totalLifetimeValueCents = 0;
    let lifetimeValueCount = 0;

    // Churn risk tracking
    let highChurnRiskCount = 0;
    let mediumChurnRiskCount = 0;
    const churnRiskBusinesses: Array<{
      business_id: string;
      risk_level: "high" | "medium";
      reasons: string[];
      days_since_activity: number;
    }> = [];

    // Feature adoption counters
    let spanishEnabledCount = 0;
    let upsellsEnabledCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Planned feature metric
    let bundlesEnabledCount = 0;
    let calendarIntegratedCount = 0;
    let webhooksConfiguredCount = 0;

    // Call success rates per business
    const businessCallSuccessRates: Array<{
      business_id: string;
      total_calls: number;
      success_rate: number;
    }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (businesses || []).forEach((b: any) => {
      const createdAt = new Date(b.created_at);
      const updatedAt = new Date(b.updated_at);
      const onboardingCompletedAt = b.onboarding_completed_at ? new Date(b.onboarding_completed_at) : null;
      const priceCents = b.plans?.price_cents || 0;

      if (b.subscription_status === "active") {
        activeCustomers++;
        totalMrrCents += priceCents;

        // Calculate lifetime value (months active * price)
        if (onboardingCompletedAt) {
          const monthsActive = Math.max(1, Math.ceil((now.getTime() - onboardingCompletedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));
          totalLifetimeValueCents += monthsActive * priceCents;
          lifetimeValueCount++;
        }

        // Check churn risk indicators
        const metrics = callMetrics[b.id] || { total: 0, failed: 0, lastCall: null };
        const lastActivity = metrics.lastCall || updatedAt;
        const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));
        const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;

        const churnReasons: string[] = [];

        // Check for inactivity
        if (daysSinceActivity > CHURN_RISK_HIGH_DAYS) {
          churnReasons.push(`No activity for ${daysSinceActivity} days`);
        } else if (daysSinceActivity > CHURN_RISK_MEDIUM_DAYS) {
          churnReasons.push(`Low activity (${daysSinceActivity} days since last call)`);
        }

        // Check for high failure rate
        if (metrics.total >= 5 && failureRate > HIGH_FAILURE_RATE_THRESHOLD) {
          churnReasons.push(`High call failure rate (${Math.round(failureRate * 100)}%)`);
        }

        // Check for low usage
        const usageRatio = (b.minutes_included ?? 0) > 0 ? b.minutes_used_this_cycle / b.minutes_included : 0;
        if (usageRatio < 0.1 && daysSinceActivity > 7) {
          churnReasons.push("Very low minutes usage (<10%)");
        }

        if (churnReasons.length > 0) {
          const riskLevel = daysSinceActivity > CHURN_RISK_HIGH_DAYS || failureRate > 0.3 ? "high" : "medium";
          if (riskLevel === "high") {
            highChurnRiskCount++;
          } else {
            mediumChurnRiskCount++;
          }
          churnRiskBusinesses.push({
            business_id: b.id,
            risk_level: riskLevel,
            reasons: churnReasons,
            days_since_activity: daysSinceActivity,
          });
        }

        // Call success rates
        if (metrics.total > 0) {
          totalCalls += metrics.total;
          totalFailedCalls += metrics.failed;
          businessCallSuccessRates.push({
            business_id: b.id,
            total_calls: metrics.total,
            success_rate: Math.round((1 - failureRate) * 100 * 10) / 10,
          });
        }

        // Feature adoption tracking
        const features = aiConfigMap.get(b.id);
        if (features?.spanish) spanishEnabledCount++;
        if (features?.upsells || features?.bundles || features?.packages || features?.memberships) upsellsEnabledCount++;
        if (features?.bundles) bundlesEnabledCount++;
        if (calendarSet.has(b.id)) calendarIntegratedCount++;
        if (webhookSet.has(b.id)) webhooksConfiguredCount++;
      }

      if (b.subscription_status === "cancelled") {
        churnedCustomers++;
        if (updatedAt >= thirtyDaysAgo) {
          churnedCustomers30d++;
        }
      }

      if (createdAt >= thirtyDaysAgo && b.subscription_status !== "onboarding") {
        newCustomers30d++;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response filter
    const totalCustomers = (businesses || []).filter(
      (b: any) => b.subscription_status !== "onboarding"
    ).length;

    const arpuCents =
      activeCustomers > 0 ? Math.round(totalMrrCents / activeCustomers) : 0;

    // Calculate average customer lifetime value
    const avgLifetimeValueCents = lifetimeValueCount > 0 ? Math.round(totalLifetimeValueCents / lifetimeValueCount) : 0;

    // Overall call success rate
    const overallCallSuccessRate = totalCalls > 0 ? Math.round((1 - totalFailedCalls / totalCalls) * 100 * 10) / 10 : 100;

    // Feature adoption rates (percentage of active customers)
    const featureAdoption = {
      spanish_bilingual: activeCustomers > 0 ? Math.round((spanishEnabledCount / activeCustomers) * 100) : 0,
      upselling_features: activeCustomers > 0 ? Math.round((upsellsEnabledCount / activeCustomers) * 100) : 0,
      calendar_integration: activeCustomers > 0 ? Math.round((calendarIntegratedCount / activeCustomers) * 100) : 0,
      webhooks: activeCustomers > 0 ? Math.round((webhooksConfiguredCount / activeCustomers) * 100) : 0,
    };

    // Sort churn risk businesses by risk level and days since activity
    churnRiskBusinesses.sort((a, b) => {
      if (a.risk_level !== b.risk_level) {
        return a.risk_level === "high" ? -1 : 1;
      }
      return b.days_since_activity - a.days_since_activity;
    });

    // Sort call success rates by lowest first (to highlight problem businesses)
    businessCallSuccessRates.sort((a, b) => a.success_rate - b.success_rate);

    const summary = {
      // Core financial metrics
      total_mrr_cents: totalMrrCents,
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      churned_customers: churnedCustomers,
      arpu_cents: arpuCents,
      new_customers_30d: newCustomers30d,
      churned_customers_30d: churnedCustomers30d,

      // Call success metrics
      call_metrics: {
        total_calls_90d: totalCalls,
        overall_success_rate: overallCallSuccessRate,
        businesses_with_lowest_success: businessCallSuccessRates.slice(0, 10),
      },

      // Churn risk indicators
      churn_risk: {
        high_risk_count: highChurnRiskCount,
        medium_risk_count: mediumChurnRiskCount,
        at_risk_businesses: churnRiskBusinesses.slice(0, 20),
      },

      // Customer lifetime value
      customer_lifetime_value: {
        average_ltv_cents: avgLifetimeValueCents,
        calculated_from_customers: lifetimeValueCount,
      },

      // Feature adoption rates
      feature_adoption: featureAdoption,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    logError("Admin Financials GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
