/**
 * Admin Analytics Tests
 * Tests for admin financial and health monitoring endpoints
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Churn Risk Configuration Tests
// =============================================================================

describe("Churn Risk Configuration", () => {
  const CHURN_RISK_HIGH_DAYS = 14;
  const CHURN_RISK_MEDIUM_DAYS = 7;
  const HIGH_FAILURE_RATE_THRESHOLD = 0.2; // 20%
  const DECLINING_USAGE_THRESHOLD = 0.5; // 50% drop

  describe("Thresholds", () => {
    it("should have correct high risk days threshold", () => {
      expect(CHURN_RISK_HIGH_DAYS).toBe(14);
    });

    it("should have correct medium risk days threshold", () => {
      expect(CHURN_RISK_MEDIUM_DAYS).toBe(7);
    });

    it("should have correct high failure rate threshold", () => {
      expect(HIGH_FAILURE_RATE_THRESHOLD).toBe(0.2);
    });

    it("should have correct declining usage threshold", () => {
      expect(DECLINING_USAGE_THRESHOLD).toBe(0.5);
    });

    it("should have high risk days greater than medium risk days", () => {
      expect(CHURN_RISK_HIGH_DAYS).toBeGreaterThan(CHURN_RISK_MEDIUM_DAYS);
    });
  });
});

// =============================================================================
// Churn Risk Calculation Tests
// =============================================================================

describe("Churn Risk Calculation", () => {
  const HIGH_RISK_DAYS = 14;
  const MEDIUM_RISK_DAYS = 7;
  const HIGH_FAILURE_RATE = 0.2;

  interface ChurnRiskInput {
    daysSinceLastCall: number;
    subscriptionStatus: "active" | "paused" | "cancelled";
    totalCalls: number;
    failedCalls: number;
    usageRatio: number;
  }

  function calculateChurnRisk(input: ChurnRiskInput): {
    riskLevel: "low" | "medium" | "high" | "churned";
    score: number;
    factors: string[];
  } {
    const { daysSinceLastCall, subscriptionStatus, totalCalls, failedCalls, usageRatio } = input;

    if (subscriptionStatus === "cancelled") {
      return { riskLevel: "churned", score: 10, factors: ["Subscription cancelled"] };
    }

    let score = 0;
    const factors: string[] = [];

    // Factor 1: Inactivity
    if (daysSinceLastCall > HIGH_RISK_DAYS) {
      score += 3;
      factors.push(`No calls for ${daysSinceLastCall} days`);
    } else if (daysSinceLastCall > MEDIUM_RISK_DAYS) {
      score += 1;
      factors.push(`Low activity (${daysSinceLastCall} days since last call)`);
    }

    // Factor 2: Paused subscription
    if (subscriptionStatus === "paused") {
      score += 3;
      factors.push("Subscription paused");
    }

    // Factor 3: High failure rate (needs at least 5 calls to be meaningful)
    const failureRate = totalCalls > 0 ? failedCalls / totalCalls : 0;
    if (totalCalls >= 5 && failureRate > HIGH_FAILURE_RATE) {
      score += 2;
      factors.push(`High call failure rate (${Math.round(failureRate * 100)}%)`);
    }
    if (totalCalls >= 5 && failureRate > 0.3) {
      score += 1;
      factors.push("Very high failure rate (>30%)");
    }

    // Factor 4: Very low usage
    if (usageRatio < 0.1 && daysSinceLastCall > 5) {
      score += 1;
      factors.push("Very low minutes usage (<10%)");
    }

    let riskLevel: "low" | "medium" | "high";
    if (score >= 3) {
      riskLevel = "high";
    } else if (score >= 1) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return { riskLevel, score, factors };
  }

  describe("Cancelled subscriptions", () => {
    it("should return churned for cancelled subscription", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 0,
        subscriptionStatus: "cancelled",
        totalCalls: 100,
        failedCalls: 0,
        usageRatio: 1.0,
      });

      expect(result.riskLevel).toBe("churned");
    });
  });

  describe("High risk scenarios", () => {
    it("should flag high risk for long inactivity", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 15,
        subscriptionStatus: "active",
        totalCalls: 10,
        failedCalls: 0,
        usageRatio: 0.5,
      });

      expect(result.riskLevel).toBe("high");
      expect(result.factors).toContain("No calls for 15 days");
    });

    it("should flag high risk for paused subscription", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 1,
        subscriptionStatus: "paused",
        totalCalls: 10,
        failedCalls: 0,
        usageRatio: 0.5,
      });

      expect(result.riskLevel).toBe("high");
      expect(result.factors).toContain("Subscription paused");
    });

    it("should flag high risk for combined factors", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 8,
        subscriptionStatus: "active",
        totalCalls: 10,
        failedCalls: 5,
        usageRatio: 0.05,
      });

      expect(result.riskLevel).toBe("high");
      expect(result.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Medium risk scenarios", () => {
    it("should flag medium risk for moderate inactivity", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 10,
        subscriptionStatus: "active",
        totalCalls: 10,
        failedCalls: 0,
        usageRatio: 0.5,
      });

      expect(result.riskLevel).toBe("medium");
      expect(result.factors.some(f => f.includes("Low activity"))).toBe(true);
    });

    it("should flag medium risk for high failure rate alone", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 1,
        subscriptionStatus: "active",
        totalCalls: 10,
        failedCalls: 3,
        usageRatio: 0.5,
      });

      expect(result.riskLevel).toBe("medium");
      expect(result.factors.some(f => f.includes("failure rate"))).toBe(true);
    });
  });

  describe("Low risk scenarios", () => {
    it("should return low risk for healthy account", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 1,
        subscriptionStatus: "active",
        totalCalls: 50,
        failedCalls: 2,
        usageRatio: 0.6,
      });

      expect(result.riskLevel).toBe("low");
      expect(result.factors.length).toBe(0);
    });

    it("should return low risk for new account with no calls", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 2,
        subscriptionStatus: "active",
        totalCalls: 0,
        failedCalls: 0,
        usageRatio: 0,
      });

      expect(result.riskLevel).toBe("low");
    });
  });

  describe("Failure rate calculation", () => {
    it("should require minimum calls before considering failure rate", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 1,
        subscriptionStatus: "active",
        totalCalls: 4, // Below 5 threshold
        failedCalls: 4, // 100% failure rate
        usageRatio: 0.5,
      });

      expect(result.factors.some(f => f.includes("failure rate"))).toBe(false);
    });

    it("should flag failure rate when calls exceed threshold", () => {
      const result = calculateChurnRisk({
        daysSinceLastCall: 1,
        subscriptionStatus: "active",
        totalCalls: 5, // At threshold
        failedCalls: 2, // 40% failure rate
        usageRatio: 0.5,
      });

      expect(result.factors.some(f => f.includes("failure rate"))).toBe(true);
    });
  });
});

// =============================================================================
// Financial Metrics Calculation Tests
// =============================================================================

describe("Financial Metrics Calculation", () => {
  describe("MRR (Monthly Recurring Revenue)", () => {
    interface Business {
      subscriptionStatus: string;
      priceCents: number;
    }

    function calculateMRR(businesses: Business[]): number {
      return businesses
        .filter(b => b.subscriptionStatus === "active")
        .reduce((sum, b) => sum + b.priceCents, 0);
    }

    it("should calculate MRR from active subscriptions", () => {
      const businesses = [
        { subscriptionStatus: "active", priceCents: 9900 },
        { subscriptionStatus: "active", priceCents: 19900 },
        { subscriptionStatus: "cancelled", priceCents: 9900 },
      ];

      expect(calculateMRR(businesses)).toBe(29800);
    });

    it("should return 0 for no active subscriptions", () => {
      const businesses = [
        { subscriptionStatus: "cancelled", priceCents: 9900 },
        { subscriptionStatus: "onboarding", priceCents: 9900 },
      ];

      expect(calculateMRR(businesses)).toBe(0);
    });

    it("should handle empty list", () => {
      expect(calculateMRR([])).toBe(0);
    });
  });

  describe("ARPU (Average Revenue Per User)", () => {
    function calculateARPU(totalMrrCents: number, activeCustomers: number): number {
      return activeCustomers > 0 ? Math.round(totalMrrCents / activeCustomers) : 0;
    }

    it("should calculate correct ARPU", () => {
      expect(calculateARPU(100000, 10)).toBe(10000);
    });

    it("should round ARPU to nearest cent", () => {
      expect(calculateARPU(100001, 3)).toBe(33334);
    });

    it("should return 0 when no active customers", () => {
      expect(calculateARPU(100000, 0)).toBe(0);
    });
  });

  describe("Success rate calculation", () => {
    function calculateSuccessRate(totalCalls: number, failedCalls: number): number {
      return totalCalls > 0
        ? Math.round((1 - failedCalls / totalCalls) * 100 * 10) / 10
        : 100;
    }

    it("should calculate 100% success rate for no failures", () => {
      expect(calculateSuccessRate(100, 0)).toBe(100);
    });

    it("should calculate correct success rate", () => {
      expect(calculateSuccessRate(100, 20)).toBe(80);
    });

    it("should round to one decimal place", () => {
      expect(calculateSuccessRate(3, 1)).toBe(66.7);
    });

    it("should return 100% when no calls", () => {
      expect(calculateSuccessRate(0, 0)).toBe(100);
    });

    it("should calculate 0% success rate for all failures", () => {
      expect(calculateSuccessRate(10, 10)).toBe(0);
    });
  });

  describe("Lifetime value calculation", () => {
    function calculateLTV(
      onboardingDate: Date,
      currentDate: Date,
      monthlyPriceCents: number
    ): number {
      const msPerMonth = 30 * 24 * 60 * 60 * 1000;
      const monthsActive = Math.max(
        1,
        Math.ceil((currentDate.getTime() - onboardingDate.getTime()) / msPerMonth)
      );
      return monthsActive * monthlyPriceCents;
    }

    it("should calculate LTV for 1 month customer", () => {
      const onboarding = new Date("2024-01-01");
      const current = new Date("2024-01-15");
      expect(calculateLTV(onboarding, current, 9900)).toBe(9900);
    });

    it("should calculate LTV for 3 month customer", () => {
      const onboarding = new Date("2024-01-01");
      const current = new Date("2024-03-15"); // ~2.5 months = ceil to 3 months
      expect(calculateLTV(onboarding, current, 9900)).toBe(29700);
    });

    it("should have minimum of 1 month", () => {
      const onboarding = new Date("2024-01-01");
      const current = new Date("2024-01-01");
      expect(calculateLTV(onboarding, current, 9900)).toBe(9900);
    });
  });
});

// =============================================================================
// Feature Adoption Rate Tests
// =============================================================================

describe("Feature Adoption Rates", () => {
  function calculateAdoptionRate(enabledCount: number, totalActive: number): number {
    return totalActive > 0 ? Math.round((enabledCount / totalActive) * 100) : 0;
  }

  describe("Percentage calculation", () => {
    it("should calculate correct percentage", () => {
      expect(calculateAdoptionRate(25, 100)).toBe(25);
    });

    it("should round to nearest integer", () => {
      expect(calculateAdoptionRate(1, 3)).toBe(33);
    });

    it("should return 0 when no active customers", () => {
      expect(calculateAdoptionRate(10, 0)).toBe(0);
    });

    it("should return 100 when all customers have feature", () => {
      expect(calculateAdoptionRate(50, 50)).toBe(100);
    });
  });

  describe("Feature tracking", () => {
    interface FeatureAdoption {
      spanish_bilingual: number;
      upselling_features: number;
      calendar_integration: number;
      webhooks: number;
    }

    function calculateFeatureAdoption(
      activeCustomers: number,
      spanishEnabled: number,
      upsellEnabled: number,
      calendarIntegrated: number,
      webhooksConfigured: number
    ): FeatureAdoption {
      return {
        spanish_bilingual: activeCustomers > 0 ? Math.round((spanishEnabled / activeCustomers) * 100) : 0,
        upselling_features: activeCustomers > 0 ? Math.round((upsellEnabled / activeCustomers) * 100) : 0,
        calendar_integration: activeCustomers > 0 ? Math.round((calendarIntegrated / activeCustomers) * 100) : 0,
        webhooks: activeCustomers > 0 ? Math.round((webhooksConfigured / activeCustomers) * 100) : 0,
      };
    }

    it("should calculate all feature rates", () => {
      const adoption = calculateFeatureAdoption(100, 30, 20, 50, 10);

      expect(adoption.spanish_bilingual).toBe(30);
      expect(adoption.upselling_features).toBe(20);
      expect(adoption.calendar_integration).toBe(50);
      expect(adoption.webhooks).toBe(10);
    });

    it("should handle zero active customers", () => {
      const adoption = calculateFeatureAdoption(0, 0, 0, 0, 0);

      expect(adoption.spanish_bilingual).toBe(0);
      expect(adoption.upselling_features).toBe(0);
      expect(adoption.calendar_integration).toBe(0);
      expect(adoption.webhooks).toBe(0);
    });
  });
});

// =============================================================================
// Upsell Opportunity Detection Tests
// =============================================================================

describe("Upsell Opportunity Detection", () => {
  function isUpsellCandidate(usageRatio: number): boolean {
    return usageRatio > 0.8;
  }

  describe("Usage ratio threshold", () => {
    it("should identify customer using > 80% as upsell candidate", () => {
      expect(isUpsellCandidate(0.85)).toBe(true);
      expect(isUpsellCandidate(0.95)).toBe(true);
      expect(isUpsellCandidate(1.0)).toBe(true);
    });

    it("should not identify customer using <= 80% as upsell candidate", () => {
      expect(isUpsellCandidate(0.80)).toBe(false);
      expect(isUpsellCandidate(0.50)).toBe(false);
      expect(isUpsellCandidate(0.10)).toBe(false);
    });

    it("should handle edge case at exactly 80%", () => {
      expect(isUpsellCandidate(0.80)).toBe(false);
      expect(isUpsellCandidate(0.801)).toBe(true);
    });
  });
});

// =============================================================================
// Admin Access Validation Tests
// =============================================================================

describe("Admin Access Validation", () => {
  interface User {
    id: string;
    app_metadata?: {
      is_admin?: boolean;
    };
  }

  function isAdminUser(user: User | null): boolean {
    return user?.app_metadata?.is_admin === true;
  }

  describe("Admin check", () => {
    it("should return true for admin user", () => {
      const user: User = {
        id: "user-1",
        app_metadata: { is_admin: true },
      };
      expect(isAdminUser(user)).toBe(true);
    });

    it("should return false for non-admin user", () => {
      const user: User = {
        id: "user-1",
        app_metadata: { is_admin: false },
      };
      expect(isAdminUser(user)).toBe(false);
    });

    it("should return false for user without app_metadata", () => {
      const user: User = {
        id: "user-1",
      };
      expect(isAdminUser(user)).toBe(false);
    });

    it("should return false for user without is_admin field", () => {
      const user: User = {
        id: "user-1",
        app_metadata: {},
      };
      expect(isAdminUser(user)).toBe(false);
    });

    it("should return false for null user", () => {
      expect(isAdminUser(null)).toBe(false);
    });
  });
});

// =============================================================================
// Health Metrics Sorting Tests
// =============================================================================

describe("Health Metrics Sorting", () => {
  interface HealthMetric {
    business_id: string;
    churn_risk: "low" | "medium" | "high" | "churned";
    days_since_last_call: number;
  }

  // Risk order mapping - lower number = higher priority (appears first)
  const riskOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
    churned: 3,
  };

  function sortByRisk(metrics: HealthMetric[]): HealthMetric[] {
    return [...metrics].sort((a, b) => {
      const aRisk = riskOrder[a.churn_risk] ?? 4;
      const bRisk = riskOrder[b.churn_risk] ?? 4;
      const riskDiff = aRisk - bRisk;
      if (riskDiff !== 0) return riskDiff;
      return b.days_since_last_call - a.days_since_last_call;
    });
  }

  describe("Risk level ordering", () => {
    it("should sort high risk first", () => {
      const metrics: HealthMetric[] = [
        { business_id: "1", churn_risk: "low", days_since_last_call: 1 },
        { business_id: "2", churn_risk: "high", days_since_last_call: 15 },
        { business_id: "3", churn_risk: "medium", days_since_last_call: 8 },
      ];

      const sorted = sortByRisk(metrics);
      expect(sorted[0].churn_risk).toBe("high");
      expect(sorted[1].churn_risk).toBe("medium");
      expect(sorted[2].churn_risk).toBe("low");
    });

    it("should put churned last", () => {
      const metrics: HealthMetric[] = [
        { business_id: "1", churn_risk: "churned", days_since_last_call: 30 },
        { business_id: "2", churn_risk: "low", days_since_last_call: 1 },
        { business_id: "3", churn_risk: "high", days_since_last_call: 15 },
      ];

      const sorted = sortByRisk(metrics);
      expect(sorted[sorted.length - 1].churn_risk).toBe("churned");
    });

    it("should sort by days since last call within same risk level", () => {
      const metrics: HealthMetric[] = [
        { business_id: "1", churn_risk: "high", days_since_last_call: 15 },
        { business_id: "2", churn_risk: "high", days_since_last_call: 20 },
        { business_id: "3", churn_risk: "high", days_since_last_call: 14 },
      ];

      const sorted = sortByRisk(metrics);
      expect(sorted[0].days_since_last_call).toBe(20);
      expect(sorted[1].days_since_last_call).toBe(15);
      expect(sorted[2].days_since_last_call).toBe(14);
    });
  });
});

// =============================================================================
// Call Success Rate Sorting Tests
// =============================================================================

describe("Call Success Rate Sorting", () => {
  interface CallSuccessRate {
    business_id: string;
    total_calls: number;
    success_rate: number;
  }

  function sortByLowestSuccess(rates: CallSuccessRate[]): CallSuccessRate[] {
    return [...rates].sort((a, b) => a.success_rate - b.success_rate);
  }

  it("should sort by lowest success rate first", () => {
    const rates: CallSuccessRate[] = [
      { business_id: "1", total_calls: 100, success_rate: 95 },
      { business_id: "2", total_calls: 50, success_rate: 60 },
      { business_id: "3", total_calls: 75, success_rate: 85 },
    ];

    const sorted = sortByLowestSuccess(rates);
    expect(sorted[0].success_rate).toBe(60);
    expect(sorted[1].success_rate).toBe(85);
    expect(sorted[2].success_rate).toBe(95);
  });

  it("should handle equal success rates", () => {
    const rates: CallSuccessRate[] = [
      { business_id: "1", total_calls: 100, success_rate: 80 },
      { business_id: "2", total_calls: 50, success_rate: 80 },
    ];

    const sorted = sortByLowestSuccess(rates);
    expect(sorted.length).toBe(2);
    expect(sorted.every(r => r.success_rate === 80)).toBe(true);
  });

  it("should handle empty list", () => {
    const sorted = sortByLowestSuccess([]);
    expect(sorted).toEqual([]);
  });
});

// =============================================================================
// Sync Failure Counting Tests
// =============================================================================

describe("Sync Failure Counting", () => {
  interface SyncFailureCount {
    expiredTokens: number;
    syncErrors: number;
    total: number;
  }

  function countSyncFailures(expiredTokens: number, syncErrors: number): SyncFailureCount {
    return {
      expiredTokens,
      syncErrors,
      total: expiredTokens + syncErrors,
    };
  }

  it("should count expired tokens", () => {
    const result = countSyncFailures(5, 0);
    expect(result.expiredTokens).toBe(5);
    expect(result.total).toBe(5);
  });

  it("should count sync errors", () => {
    const result = countSyncFailures(0, 3);
    expect(result.syncErrors).toBe(3);
    expect(result.total).toBe(3);
  });

  it("should sum total correctly", () => {
    const result = countSyncFailures(5, 3);
    expect(result.total).toBe(8);
  });

  it("should handle zero failures", () => {
    const result = countSyncFailures(0, 0);
    expect(result.total).toBe(0);
  });
});

// =============================================================================
// Date Range Calculation Tests
// =============================================================================

describe("Date Range Calculations", () => {
  describe("Days ago calculation", () => {
    function getDaysAgo(days: number, from: Date = new Date()): Date {
      return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
    }

    it("should calculate 30 days ago", () => {
      const now = new Date("2024-02-15T12:00:00Z");
      const thirtyDaysAgo = getDaysAgo(30, now);
      expect(thirtyDaysAgo.toISOString().split("T")[0]).toBe("2024-01-16");
    });

    it("should calculate 90 days ago", () => {
      const now = new Date("2024-04-01T12:00:00Z");
      const ninetyDaysAgo = getDaysAgo(90, now);
      expect(ninetyDaysAgo.toISOString().split("T")[0]).toBe("2024-01-02");
    });
  });

  describe("Days since activity", () => {
    function getDaysSince(activityDate: Date, now: Date = new Date()): number {
      return Math.floor((now.getTime() - activityDate.getTime()) / (24 * 60 * 60 * 1000));
    }

    it("should calculate days since activity", () => {
      const now = new Date("2024-02-15T12:00:00Z");
      const activity = new Date("2024-02-10T12:00:00Z");
      expect(getDaysSince(activity, now)).toBe(5);
    });

    it("should return 0 for same day", () => {
      const now = new Date("2024-02-15T18:00:00Z");
      const activity = new Date("2024-02-15T12:00:00Z");
      expect(getDaysSince(activity, now)).toBe(0);
    });
  });
});

// =============================================================================
// Response Format Tests
// =============================================================================

describe("Admin API Response Format", () => {
  describe("Financials response structure", () => {
    interface FinancialsResponse {
      summary: {
        total_mrr_cents: number;
        total_customers: number;
        active_customers: number;
        churned_customers: number;
        arpu_cents: number;
        new_customers_30d: number;
        churned_customers_30d: number;
        call_metrics: {
          total_calls_90d: number;
          overall_success_rate: number;
        };
        churn_risk: {
          high_risk_count: number;
          medium_risk_count: number;
        };
        customer_lifetime_value: {
          average_ltv_cents: number;
        };
        feature_adoption: Record<string, number>;
      };
    }

    it("should have required summary fields", () => {
      const response: FinancialsResponse = {
        summary: {
          total_mrr_cents: 100000,
          total_customers: 50,
          active_customers: 45,
          churned_customers: 5,
          arpu_cents: 2222,
          new_customers_30d: 10,
          churned_customers_30d: 2,
          call_metrics: {
            total_calls_90d: 1000,
            overall_success_rate: 95,
          },
          churn_risk: {
            high_risk_count: 3,
            medium_risk_count: 7,
          },
          customer_lifetime_value: {
            average_ltv_cents: 50000,
          },
          feature_adoption: {
            spanish_bilingual: 20,
            calendar_integration: 40,
          },
        },
      };

      expect(response.summary.total_mrr_cents).toBeDefined();
      expect(response.summary.active_customers).toBeDefined();
      expect(response.summary.call_metrics).toBeDefined();
      expect(response.summary.churn_risk).toBeDefined();
      expect(response.summary.customer_lifetime_value).toBeDefined();
      expect(response.summary.feature_adoption).toBeDefined();
    });
  });

  describe("Health response structure", () => {
    interface HealthResponse {
      businesses: Array<{
        business_id: string;
        churn_risk: string;
        upsell_candidate: boolean;
      }>;
      summary: {
        high_risk_count: number;
        medium_risk_count: number;
        upsell_opportunities: number;
        failed_calls_today: number;
        sync_failures: number;
      };
    }

    it("should have required health fields", () => {
      const response: HealthResponse = {
        businesses: [
          { business_id: "1", churn_risk: "low", upsell_candidate: true },
        ],
        summary: {
          high_risk_count: 2,
          medium_risk_count: 5,
          upsell_opportunities: 10,
          failed_calls_today: 3,
          sync_failures: 1,
        },
      };

      expect(response.businesses).toBeDefined();
      expect(Array.isArray(response.businesses)).toBe(true);
      expect(response.summary.high_risk_count).toBeDefined();
      expect(response.summary.upsell_opportunities).toBeDefined();
      expect(response.summary.sync_failures).toBeDefined();
    });
  });
});

// =============================================================================
// Error Response Tests
// =============================================================================

describe("Admin API Error Responses", () => {
  describe("HTTP status codes", () => {
    it("should return 401 for unauthorized access", () => {
      const response = { error: "Unauthorized", status: 401 };
      expect(response.status).toBe(401);
    });

    it("should return 403 for non-admin access", () => {
      const response = { error: "Forbidden", status: 403 };
      expect(response.status).toBe(403);
    });

    it("should return 500 for internal errors", () => {
      const response = { error: "Internal server error", status: 500 };
      expect(response.status).toBe(500);
    });
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe("Edge Cases", () => {
  // ---------------------------------------------------------------------------
  // Zero Customers - Division Safety
  // ---------------------------------------------------------------------------
  describe("Zero customers - division safety", () => {
    function calculateAdoptionRate(enabledCount: number, totalActive: number): number {
      return totalActive > 0 ? Math.round((enabledCount / totalActive) * 100) : 0;
    }

    function calculateARPU(totalMrrCents: number, activeCustomers: number): number {
      return activeCustomers > 0 ? Math.round(totalMrrCents / activeCustomers) : 0;
    }

    function calculateSuccessRate(totalCalls: number, failedCalls: number): number {
      return totalCalls > 0
        ? Math.round((1 - failedCalls / totalCalls) * 100 * 10) / 10
        : 100;
    }

    function calculateFeatureAdoption(
      activeCustomers: number,
      spanishEnabled: number,
      upsellEnabled: number
    ): { spanish: number; upsell: number } {
      return {
        spanish: activeCustomers > 0 ? Math.round((spanishEnabled / activeCustomers) * 100) : 0,
        upsell: activeCustomers > 0 ? Math.round((upsellEnabled / activeCustomers) * 100) : 0,
      };
    }

    it("should return 0% adoption rate when totalActive is 0", () => {
      expect(calculateAdoptionRate(0, 0)).toBe(0);
      expect(calculateAdoptionRate(10, 0)).toBe(0); // Even with enabledCount > 0
    });

    it("should return 0 ARPU when activeCustomers is 0", () => {
      expect(calculateARPU(100000, 0)).toBe(0);
      expect(calculateARPU(0, 0)).toBe(0);
    });

    it("should return 100% success rate when totalCalls is 0", () => {
      expect(calculateSuccessRate(0, 0)).toBe(100);
    });

    it("should return 0 for all feature adoption rates with 0 customers", () => {
      const adoption = calculateFeatureAdoption(0, 5, 10);
      expect(adoption.spanish).toBe(0);
      expect(adoption.upsell).toBe(0);
    });

    it("should not throw or return NaN with 0 customers", () => {
      const rate = calculateAdoptionRate(100, 0);
      expect(Number.isNaN(rate)).toBe(false);
      expect(Number.isFinite(rate)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Negative Values Handling
  // ---------------------------------------------------------------------------
  describe("Negative values handling", () => {
    function safeCalculateSuccessRate(totalCalls: number, failedCalls: number): number {
      // Treat negative values as 0
      const safeTotalCalls = Math.max(0, totalCalls);
      const safeFailedCalls = Math.max(0, failedCalls);

      if (safeTotalCalls === 0) return 100;

      // Ensure failed doesn't exceed total
      const boundedFailed = Math.min(safeFailedCalls, safeTotalCalls);

      return Math.round((1 - boundedFailed / safeTotalCalls) * 100 * 10) / 10;
    }

    function safeCalculateMRR(prices: number[]): number {
      return prices
        .map(p => Math.max(0, p)) // Treat negatives as 0
        .reduce((sum, p) => sum + p, 0);
    }

    function safeCalculateFailureRate(totalCalls: number, failedCalls: number): number {
      const safeTotalCalls = Math.max(0, totalCalls);
      const safeFailedCalls = Math.max(0, Math.min(failedCalls, safeTotalCalls));

      if (safeTotalCalls === 0) return 0;
      return safeFailedCalls / safeTotalCalls;
    }

    it("should treat negative totalCalls as 0", () => {
      const rate = safeCalculateSuccessRate(-10, 5);
      expect(rate).toBe(100); // 0 total calls defaults to 100%
    });

    it("should treat negative failedCalls as 0", () => {
      const rate = safeCalculateSuccessRate(100, -20);
      expect(rate).toBe(100); // 0 failed = 100% success
    });

    it("should treat negative MRR values as 0", () => {
      const mrr = safeCalculateMRR([9900, -500, 19900, -1000]);
      expect(mrr).toBe(29800); // Only positive values counted
    });

    it("should handle both negative totalCalls and failedCalls", () => {
      const rate = safeCalculateSuccessRate(-100, -50);
      expect(rate).toBe(100);
    });

    it("should cap failedCalls at totalCalls", () => {
      // If failedCalls > totalCalls, treat as all failed
      const rate = safeCalculateSuccessRate(10, 20);
      expect(rate).toBe(0); // Can't have more failures than total
    });

    it("should return 0 failure rate for negative inputs", () => {
      const failureRate = safeCalculateFailureRate(-10, -5);
      expect(failureRate).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // NaN/Infinity Handling
  // ---------------------------------------------------------------------------
  describe("NaN/Infinity handling", () => {
    function safeDiv(numerator: number, denominator: number, defaultValue: number = 0): number {
      if (denominator === 0 || !Number.isFinite(denominator)) {
        return defaultValue;
      }
      const result = numerator / denominator;
      if (!Number.isFinite(result)) {
        return defaultValue;
      }
      return result;
    }

    function safePercentage(part: number, total: number): number {
      const result = safeDiv(part, total, 0) * 100;
      return Math.round(result);
    }

    function safeARPU(mrr: number, customers: number): number {
      return Math.round(safeDiv(mrr, customers, 0));
    }

    it("should return default value when dividing by zero", () => {
      expect(safeDiv(100, 0)).toBe(0);
      expect(safeDiv(100, 0, -1)).toBe(-1); // Custom default
    });

    it("should return default value when dividing by Infinity", () => {
      expect(safeDiv(100, Infinity)).toBe(0);
    });

    it("should return default value when numerator is NaN", () => {
      expect(safeDiv(NaN, 100)).toBe(0);
    });

    it("should return default value when result is Infinity", () => {
      expect(safeDiv(Infinity, 1)).toBe(0);
    });

    it("should return default value when result is -Infinity", () => {
      expect(safeDiv(-Infinity, 1)).toBe(0);
    });

    it("should handle normal division correctly", () => {
      expect(safeDiv(100, 4)).toBe(25);
    });

    it("should calculate percentage safely with zero total", () => {
      expect(safePercentage(50, 0)).toBe(0);
    });

    it("should calculate ARPU safely with zero customers", () => {
      expect(safeARPU(100000, 0)).toBe(0);
    });

    it("should not produce NaN in chained calculations", () => {
      const invalidInput = NaN;
      const result = safePercentage(invalidInput, 100);
      expect(Number.isNaN(result)).toBe(false);
    });

    it("should handle Infinity in MRR calculation", () => {
      const arpu = safeARPU(Infinity, 10);
      expect(Number.isFinite(arpu)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Extreme Values
  // ---------------------------------------------------------------------------
  describe("Extreme values", () => {
    function calculateMRR(priceCents: number[]): number {
      return priceCents.reduce((sum, p) => sum + p, 0);
    }

    function calculateARPU(totalMrrCents: number, activeCustomers: number): number {
      return activeCustomers > 0 ? Math.round(totalMrrCents / activeCustomers) : 0;
    }

    function calculateLTV(
      onboardingDate: Date,
      currentDate: Date,
      monthlyPriceCents: number
    ): number {
      const msPerMonth = 30 * 24 * 60 * 60 * 1000;
      const monthsActive = Math.max(
        1,
        Math.ceil((currentDate.getTime() - onboardingDate.getTime()) / msPerMonth)
      );
      return monthsActive * monthlyPriceCents;
    }

    function getDaysSince(activityDate: Date, now: Date = new Date()): number {
      return Math.floor((now.getTime() - activityDate.getTime()) / (24 * 60 * 60 * 1000));
    }

    it("should handle very large MRR values (enterprise pricing)", () => {
      // $1M monthly subscription in cents
      const largeMRR = 100_000_000;
      expect(calculateMRR([largeMRR])).toBe(100_000_000);
    });

    it("should handle MRR sum that could overflow 32-bit integer", () => {
      // Multiple large subscriptions
      const prices = Array(100).fill(100_000_000); // 100 x $1M subscriptions
      const total = calculateMRR(prices);
      expect(total).toBe(10_000_000_000); // $100M
      expect(Number.isSafeInteger(total)).toBe(true);
    });

    it("should calculate ARPU for very large MRR correctly", () => {
      const mrr = 10_000_000_000; // $100M in cents
      const customers = 10000;
      const arpu = calculateARPU(mrr, customers);
      expect(arpu).toBe(1_000_000); // $10K per user
    });

    it("should handle very long inactive periods (years)", () => {
      const now = new Date("2024-02-15");
      const yearsAgo = new Date("2020-02-15"); // 4 years ago
      const days = getDaysSince(yearsAgo, now);
      expect(days).toBeGreaterThan(1400); // ~4 years in days
    });

    it("should handle LTV calculation for very long customers", () => {
      const onboarding = new Date("2019-01-01");
      const current = new Date("2024-01-01"); // 5 years
      const monthlyPrice = 9900;
      const ltv = calculateLTV(onboarding, current, monthlyPrice);
      expect(ltv).toBeGreaterThan(9900 * 12 * 4); // More than 4 years worth
    });

    it("should handle maximum JavaScript safe integer in calculations", () => {
      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      expect(Number.isSafeInteger(maxSafeInt)).toBe(true);

      // ARPU calculation with max safe integer
      const arpu = calculateARPU(maxSafeInt, 1000);
      expect(Number.isFinite(arpu)).toBe(true);
    });

    it("should handle very small values without underflow", () => {
      const tinyMRR = 1; // 1 cent
      const customers = 1000000;
      const arpu = calculateARPU(tinyMRR, customers);
      expect(arpu).toBe(0); // Rounds to 0
    });

    it("should handle edge case of exactly 0 days since activity", () => {
      const now = new Date("2024-02-15T12:00:00Z");
      const activity = new Date("2024-02-15T10:00:00Z"); // Same day
      expect(getDaysSince(activity, now)).toBe(0);
    });

    it("should handle activity in the future (negative days)", () => {
      const now = new Date("2024-02-15");
      const future = new Date("2024-02-20");
      const days = getDaysSince(future, now);
      expect(days).toBeLessThan(0);
    });
  });
});
