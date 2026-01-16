"use client";

/**
 * Admin Usage & Costs Client Component
 * Part 8: Admin Dashboard - Usage & Costs
 *
 * Features:
 * - Total calls and minutes across all businesses
 * - Estimated Retell/Twilio costs
 * - Revenue vs cost margins
 * - Per-business usage breakdown
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Clock,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageStats {
  total_calls: number;
  total_minutes: number;
  completed_calls: number;
  failed_calls: number;
  avg_call_duration_seconds: number;
  calls_today: number;
  calls_this_week: number;
  calls_this_month: number;
}

interface CostEstimate {
  retell_cost_cents: number;
  twilio_cost_cents: number;
  total_cost_cents: number;
  revenue_cents: number;
  margin_percent: number;
}

interface BusinessUsage {
  business_id: string;
  business_name: string;
  plan_name: string | null;
  total_calls: number;
  total_minutes: number;
  minutes_used_this_cycle: number;
  minutes_included: number;
  usage_percent: number;
}

export function AdminUsageClient() {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [businessUsage, setBusinessUsage] = useState<BusinessUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/usage");
      if (!response.ok) {
        throw new Error("Failed to fetch usage data");
      }
      const data = await response.json();
      setUsageStats(data.stats || null);
      setCostEstimate(data.costs || null);
      setBusinessUsage(data.businesses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage & Costs</h1>
          <p className="text-muted-foreground">
            Monitor platform usage and cost metrics
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Usage Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Phone className="h-4 w-4" />
            <span className="text-sm">Total Calls</span>
          </div>
          <p className="text-2xl font-bold">
            {formatNumber(usageStats?.total_calls || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(usageStats?.calls_this_month || 0)} this month
          </p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Total Minutes</span>
          </div>
          <p className="text-2xl font-bold">
            {formatNumber(usageStats?.total_minutes || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Avg {Math.floor((usageStats?.avg_call_duration_seconds || 0) / 60)}m{" "}
            {(usageStats?.avg_call_duration_seconds || 0) % 60}s per call
          </p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Estimated Costs</span>
          </div>
          <p className="text-2xl font-bold text-red-500">
            {formatCurrency(costEstimate?.total_cost_cents || 0)}
          </p>
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <p>Retell: {formatCurrency(costEstimate?.retell_cost_cents || 0)}</p>
            <p>Twilio: {formatCurrency(costEstimate?.twilio_cost_cents || 0)}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Gross Margin</span>
          </div>
          <p
            className={cn(
              "text-2xl font-bold",
              (costEstimate?.margin_percent || 0) >= 50
                ? "text-emerald-500"
                : (costEstimate?.margin_percent || 0) >= 30
                ? "text-amber-500"
                : "text-red-500"
            )}
          >
            {costEstimate?.margin_percent?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Revenue: {formatCurrency(costEstimate?.revenue_cents || 0)}
          </p>
        </div>
      </div>

      {/* Call Stats Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-xl font-bold">
            {formatNumber(usageStats?.calls_today || 0)} calls
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground">This Week</p>
          <p className="text-xl font-bold">
            {formatNumber(usageStats?.calls_this_week || 0)} calls
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground">Success Rate</p>
          <p className="text-xl font-bold">
            {usageStats && usageStats.total_calls > 0
              ? ((usageStats.completed_calls / usageStats.total_calls) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Per-Business Usage Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold">Usage by Business</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Business</th>
                <th className="text-left p-4 text-sm font-medium">Plan</th>
                <th className="text-left p-4 text-sm font-medium">Total Calls</th>
                <th className="text-left p-4 text-sm font-medium">Total Minutes</th>
                <th className="text-left p-4 text-sm font-medium">Cycle Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {businessUsage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No usage data available
                  </td>
                </tr>
              ) : (
                businessUsage.map((business) => (
                  <tr key={business.business_id} className="hover:bg-muted/30">
                    <td className="p-4 font-medium">{business.business_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {business.plan_name || "-"}
                    </td>
                    <td className="p-4">{formatNumber(business.total_calls)}</td>
                    <td className="p-4">{formatNumber(business.total_minutes)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-24">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              business.usage_percent > 90
                                ? "bg-red-500"
                                : business.usage_percent > 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(business.usage_percent, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground min-w-16">
                          {business.minutes_used_this_cycle}/{business.minutes_included}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
