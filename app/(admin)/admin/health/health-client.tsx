"use client";

/**
 * Admin Health Client Component
 * Part 8: Admin Dashboard - Health Monitoring
 *
 * Features:
 * - Churn risk indicators
 * - Upsell opportunities
 * - Failed call tracking
 * - Calendar sync status
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  TrendingUp,
  XCircle,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthMetrics {
  business_id: string;
  business_name: string;
  subscription_status: string;
  last_activity: string;
  days_since_last_call: number;
  minutes_used_this_cycle: number;
  minutes_included: number;
  churn_risk: "low" | "medium" | "high" | "churned";
  upsell_candidate: boolean;
  failed_call_percent: number;
}

interface HealthSummary {
  high_risk_count: number;
  medium_risk_count: number;
  upsell_opportunities: number;
  failed_calls_today: number;
  sync_failures: number;
}

export function AdminHealthClient() {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/health");
      if (!response.ok) {
        throw new Error("Failed to fetch health data");
      }
      const data = await response.json();
      setHealthMetrics(data.businesses || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getChurnBadge = (risk: string) => {
    const styles: Record<string, string> = {
      low: "bg-emerald-500/10 text-emerald-500",
      medium: "bg-amber-500/10 text-amber-500",
      high: "bg-red-500/10 text-red-500",
      churned: "bg-zinc-500/10 text-zinc-500",
    };
    const icons: Record<string, React.ReactNode> = {
      low: <CheckCircle className="h-3 w-3" />,
      medium: <Clock className="h-3 w-3" />,
      high: <AlertTriangle className="h-3 w-3" />,
      churned: <XCircle className="h-3 w-3" />,
    };
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          styles[risk] || "bg-muted text-muted-foreground"
        )}
      >
        {icons[risk]}
        {risk}
      </span>
    );
  };

  const filteredMetrics = healthMetrics.filter((m) => {
    if (filter === "all") return true;
    if (filter === "high_risk") return m.churn_risk === "high";
    if (filter === "upsell") return m.upsell_candidate;
    if (filter === "failed") return m.failed_call_percent > 10;
    return true;
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Health Monitoring</h1>
          <p className="text-muted-foreground">
            Track customer health and identify issues
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setFilter("high_risk")}
          className={cn(
            "p-4 rounded-lg border bg-card text-left transition-colors",
            filter === "high_risk" ? "border-red-500 ring-1 ring-red-500" : "border-border hover:border-red-500/50"
          )}
        >
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">High Risk</span>
          </div>
          <p className="text-2xl font-bold">{summary?.high_risk_count || 0}</p>
        </button>

        <button
          onClick={() => setFilter("all")}
          className={cn(
            "p-4 rounded-lg border bg-card text-left transition-colors",
            filter === "all" && healthMetrics.some(m => m.churn_risk === "medium")
              ? "border-amber-500 ring-1 ring-amber-500"
              : "border-border hover:border-amber-500/50"
          )}
        >
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Medium Risk</span>
          </div>
          <p className="text-2xl font-bold">{summary?.medium_risk_count || 0}</p>
        </button>

        <button
          onClick={() => setFilter("upsell")}
          className={cn(
            "p-4 rounded-lg border bg-card text-left transition-colors",
            filter === "upsell" ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border hover:border-emerald-500/50"
          )}
        >
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Upsell Opps</span>
          </div>
          <p className="text-2xl font-bold">{summary?.upsell_opportunities || 0}</p>
        </button>

        <button
          onClick={() => setFilter("failed")}
          className={cn(
            "p-4 rounded-lg border bg-card text-left transition-colors",
            filter === "failed" ? "border-red-500 ring-1 ring-red-500" : "border-border hover:border-red-500/50"
          )}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Failed Calls</span>
          </div>
          <p className="text-2xl font-bold">{summary?.failed_calls_today || 0}</p>
          <p className="text-xs text-muted-foreground">today</p>
        </button>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Sync Failures</span>
          </div>
          <p className="text-2xl font-bold">{summary?.sync_failures || 0}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All Businesses" },
          { key: "high_risk", label: "High Risk" },
          { key: "upsell", label: "Upsell Candidates" },
          { key: "failed", label: "High Failure Rate" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Health Metrics Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Business</th>
                <th className="text-left p-4 text-sm font-medium">Churn Risk</th>
                <th className="text-left p-4 text-sm font-medium">Last Activity</th>
                <th className="text-left p-4 text-sm font-medium">Usage</th>
                <th className="text-left p-4 text-sm font-medium">Failed Calls</th>
                <th className="text-left p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No businesses match the current filter
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((business) => (
                  <tr key={business.business_id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{business.business_name}</span>
                        {business.upsell_candidate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                            <TrendingUp className="h-3 w-3" />
                            Upsell
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">{getChurnBadge(business.churn_risk)}</td>
                    <td className="p-4">
                      <div>
                        <p className="text-sm">
                          {business.days_since_last_call === 0
                            ? "Today"
                            : business.days_since_last_call === 1
                            ? "Yesterday"
                            : `${business.days_since_last_call} days ago`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(business.last_activity).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-20">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              business.minutes_used_this_cycle / business.minutes_included > 0.9
                                ? "bg-red-500"
                                : business.minutes_used_this_cycle / business.minutes_included > 0.7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(
                                (business.minutes_used_this_cycle / business.minutes_included) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(
                            (business.minutes_used_this_cycle / business.minutes_included) * 100
                          )}
                          %
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          business.failed_call_percent > 20
                            ? "text-red-500"
                            : business.failed_call_percent > 10
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {business.failed_call_percent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" title="View calls">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Contact">
                          <Mail className="h-4 w-4" />
                        </Button>
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
