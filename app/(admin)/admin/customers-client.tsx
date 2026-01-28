"use client";

/**
 * Admin Customers Client Component
 * Part 8: Admin Dashboard - Customers
 *
 * Features:
 * - List all businesses with status, plan, metrics
 * - Actions: impersonate, pause, contact
 * - Search and filter by status
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Mail,
  Pause,
  Play,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessMetrics {
  business_id: string;
  business_name: string;
  subscription_status: string;
  created_at: string;
  updated_at: string;
  plan_name: string | null;
  plan_price: number | null;
  minutes_used_this_cycle: number;
  minutes_included: number;
  usage_percent: number;
  total_calls: number;
  completed_calls: number;
  failed_calls: number;
  total_appointments: number;
  total_call_seconds: number | null;
  owner_email: string | null;
  owner_phone: string | null;
}

interface FinancialSummary {
  total_mrr_cents: number;
  total_customers: number;
  active_customers: number;
  churned_customers: number;
  arpu_cents: number;
  new_customers_30d: number;
  churned_customers_30d: number;
}

export function AdminCustomersClient() {
  const [businesses, setBusinesses] = useState<BusinessMetrics[]>([]);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [businessesRes, financialsRes] = await Promise.all([
        fetch("/api/admin/customers"),
        fetch("/api/admin/financials"),
      ]);

      if (!businessesRes.ok || !financialsRes.ok) {
        throw new Error("Failed to fetch admin data");
      }

      const businessesData = await businessesRes.json();
      const financialsData = await financialsRes.json();

      setBusinesses(businessesData.businesses || []);
      setFinancials(financialsData.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || b.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-500",
      paused: "bg-amber-500/10 text-amber-500",
      cancelled: "bg-red-500/10 text-red-500",
      onboarding: "bg-blue-500/10 text-blue-500",
    };
    const icons: Record<string, React.ReactNode> = {
      active: <CheckCircle className="h-3 w-3" />,
      paused: <Pause className="h-3 w-3" />,
      cancelled: <XCircle className="h-3 w-3" />,
      onboarding: <Clock className="h-3 w-3" />,
    };
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          styles[status] || "bg-muted text-muted-foreground"
        )}
      >
        {icons[status]}
        {status}
      </span>
    );
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const _formatMinutes = (seconds: number | null) => {
    if (!seconds) return "0m";
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
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
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage all businesses and their subscriptions
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Financial Summary Cards */}
      {financials && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground">MRR</p>
            <p className="text-2xl font-bold">
              {formatCurrency(financials.total_mrr_cents)}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground">Active Customers</p>
            <p className="text-2xl font-bold">{financials.active_customers}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground">ARPU</p>
            <p className="text-2xl font-bold">
              {formatCurrency(financials.arpu_cents)}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground">New (30d)</p>
            <p className="text-2xl font-bold text-emerald-500">
              +{financials.new_customers_30d}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses or emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "paused", "cancelled", "onboarding"].map(
            (status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : status}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Business</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-sm font-medium">Plan</th>
                <th className="text-left p-4 text-sm font-medium">Usage</th>
                <th className="text-left p-4 text-sm font-medium">Calls</th>
                <th className="text-left p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No businesses found
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => (
                  <tr key={business.business_id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{business.business_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {business.owner_email}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(business.subscription_status)}
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">
                          {business.plan_name || "No plan"}
                        </p>
                        {business.plan_price && (
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(business.plan_price)}/mo
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
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
                          <span className="text-sm text-muted-foreground">
                            {business.usage_percent}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {business.minutes_used_this_cycle}/{business.minutes_included} min
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {business.total_calls}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {business.total_appointments}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/customers/${business.business_id}`}>
                          <Button variant="ghost" size="icon" title="View details">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {business.owner_email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Send email"
                            asChild
                          >
                            <a href={`mailto:${business.owner_email}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {business.subscription_status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pause subscription"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : business.subscription_status === "paused" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Resume subscription"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : null}
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
