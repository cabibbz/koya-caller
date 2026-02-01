"use client";

/**
 * Admin Subscriptions Client Component
 * Manage subscriptions: pause/resume/cancel, apply credits, change plans
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  Pause,
  Play,
  XCircle,
  Plus,
  AlertCircle,
  Loader2,
  ArrowUpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Subscription {
  business_id: string;
  business_name: string;
  owner_email: string;
  subscription_status: string;
  plan_name: string | null;
  plan_price: number | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  minutes_included: number;
  minutes_used_this_cycle: number;
  current_cycle_start: string | null;
  current_cycle_end: string | null;
}

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  included_minutes: number;
}

export function SubscriptionsClient() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [creditModal, setCreditModal] = useState<{ businessId: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [planModal, setPlanModal] = useState<{ businessId: string; name: string; currentPlan: string | null } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, plansRes] = await Promise.all([
        fetch("/api/admin/subscriptions"),
        fetch("/api/admin/plans"),
      ]);

      if (!subsRes.ok) throw new Error("Failed to fetch subscriptions");

      const subsData = await subsRes.json();
      const plansData = plansRes.ok ? await plansRes.json() : { plans: [] };

      setSubscriptions(subsData.subscriptions || []);
      setPlans(plansData.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (businessId: string, action: "pause" | "resume" | "cancel") => {
    setActionLoading(`${businessId}-${action}`);
    try {
      const response = await fetch("/api/admin/subscriptions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action }),
      });

      if (!response.ok) throw new Error("Action failed");

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApplyCredit = async () => {
    if (!creditModal || !creditAmount) return;

    setActionLoading(`${creditModal.businessId}-credit`);
    try {
      const response = await fetch("/api/admin/subscriptions/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: creditModal.businessId,
          minutes: parseInt(creditAmount, 10),
        }),
      });

      if (!response.ok) throw new Error("Failed to apply credit");

      setCreditModal(null);
      setCreditAmount("");
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply credit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (planId: string) => {
    if (!planModal) return;

    setActionLoading(`${planModal.businessId}-plan`);
    try {
      const response = await fetch("/api/admin/subscriptions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: planModal.businessId,
          planId,
        }),
      });

      if (!response.ok) throw new Error("Failed to change plan");

      setPlanModal(null);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to change plan");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSubscriptions = subscriptions.filter(
    (s) =>
      s.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-500",
      paused: "bg-amber-500/10 text-amber-500",
      cancelled: "bg-red-500/10 text-red-500",
      onboarding: "bg-blue-500/10 text-blue-500",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", styles[status] || "bg-muted")}>
        {status}
      </span>
    );
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
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">Manage customer subscriptions and billing</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by business or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Business</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-sm font-medium">Plan</th>
                <th className="text-left p-4 text-sm font-medium">Usage</th>
                <th className="text-left p-4 text-sm font-medium">Billing Cycle</th>
                <th className="text-left p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <tr key={sub.business_id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{sub.business_name}</p>
                        <p className="text-sm text-muted-foreground">{sub.owner_email}</p>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(sub.subscription_status)}</td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{sub.plan_name || "No plan"}</p>
                        {sub.plan_price && (
                          <p className="text-sm text-muted-foreground">{formatCurrency(sub.plan_price)}/mo</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">
                        {sub.minutes_used_this_cycle} / {sub.minutes_included} min
                      </p>
                    </td>
                    <td className="p-4">
                      {sub.current_cycle_start && sub.current_cycle_end ? (
                        <p className="text-sm text-muted-foreground">
                          {new Date(sub.current_cycle_start).toLocaleDateString()} -{" "}
                          {new Date(sub.current_cycle_end).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">-</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {sub.subscription_status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pause subscription"
                            onClick={() => handleAction(sub.business_id, "pause")}
                            disabled={actionLoading === `${sub.business_id}-pause`}
                          >
                            {actionLoading === `${sub.business_id}-pause` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {sub.subscription_status === "paused" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Resume subscription"
                            onClick={() => handleAction(sub.business_id, "resume")}
                            disabled={actionLoading === `${sub.business_id}-resume`}
                          >
                            {actionLoading === `${sub.business_id}-resume` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {sub.subscription_status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancel subscription"
                            onClick={() => handleAction(sub.business_id, "cancel")}
                            disabled={actionLoading === `${sub.business_id}-cancel`}
                          >
                            {actionLoading === `${sub.business_id}-cancel` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Add minutes credit"
                          onClick={() => setCreditModal({ businessId: sub.business_id, name: sub.business_name })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Change plan"
                          onClick={() =>
                            setPlanModal({
                              businessId: sub.business_id,
                              name: sub.business_name,
                              currentPlan: sub.plan_name,
                            })
                          }
                        >
                          <ArrowUpCircle className="h-4 w-4" />
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

      {/* Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Minutes Credit</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adding credit to: <strong>{creditModal.name}</strong>
            </p>
            <Input
              type="number"
              placeholder="Minutes to add"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreditModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyCredit}
                disabled={!creditAmount || actionLoading === `${creditModal.businessId}-credit`}
              >
                {actionLoading === `${creditModal.businessId}-credit` ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Credit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Change Plan</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Changing plan for: <strong>{planModal.name}</strong>
              <br />
              Current plan: {planModal.currentPlan || "None"}
            </p>
            <div className="space-y-2 mb-4">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={actionLoading === `${planModal.businessId}-plan`}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-colors",
                    plan.name === planModal.currentPlan
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(plan.price_cents)}/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.included_minutes} minutes included</p>
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setPlanModal(null)} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
