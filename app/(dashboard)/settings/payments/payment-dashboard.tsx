"use client";

/**
 * Payment Dashboard Component
 * Task P3-15: Payment Management Dashboard UI
 *
 * Features:
 * - Stripe Connect onboarding
 * - Account status display
 * - Payout settings
 * - Payment history table
 * - Revenue overview cards
 * - Fee breakdown
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CreditCard,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Receipt,
  Clock,
  AlertTriangle,
  Settings,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  AlertDescription,
  Label,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton, SkeletonStats, SkeletonTableRow } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

interface AccountStatus {
  connected: boolean;
  accountId: string | null;
  isActive: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
}

interface PayoutSchedule {
  interval: "manual" | "daily" | "weekly" | "monthly";
  weeklyAnchor?: string;
  monthlyAnchor?: number;
  delayDays: number;
}

interface Transaction {
  id: string;
  appointmentId?: string;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded";
  paymentType: "deposit" | "balance" | "full";
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  createdAt: string;
}

interface PeriodSummary {
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  depositCount?: number;
  balanceCount?: number;
}

interface RevenueSummary {
  connected: boolean;
  accountId?: string;
  isActive?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  today: PeriodSummary | null;
  thisWeek: PeriodSummary | null;
  thisMonth: PeriodSummary | null;
  allTime: PeriodSummary | null;
  fees?: {
    platformFeeRate: number;
    minimumFeeCents: number;
    stripeFeeRate: number;
    stripeFeeFixed: number;
  };
}

interface PaymentDashboardProps {
  businessId: string;
  userEmail: string;
}

// ============================================
// Helper Functions
// ============================================

function formatCurrency(cents: number, currency = "usd"): string {
  if (typeof cents !== 'number' || isNaN(cents)) {
    return '$0.00';
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function getStatusBadge(status: Transaction["status"]) {
  const variants: Record<Transaction["status"], { variant: "success" | "destructive" | "warning" | "secondary"; label: string }> = {
    succeeded: { variant: "success", label: "Succeeded" },
    pending: { variant: "warning", label: "Pending" },
    failed: { variant: "destructive", label: "Failed" },
    refunded: { variant: "secondary", label: "Refunded" },
    partially_refunded: { variant: "secondary", label: "Partial Refund" },
  };
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPaymentTypeBadge(type: Transaction["paymentType"]) {
  const variants: Record<Transaction["paymentType"], { variant: "default" | "secondary" | "outline"; label: string }> = {
    deposit: { variant: "outline", label: "Deposit" },
    balance: { variant: "secondary", label: "Balance" },
    full: { variant: "default", label: "Full Payment" },
  };
  const config = variants[type];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================
// Component
// ============================================

export function PaymentDashboard({ businessId: _businessId, userEmail: _userEmail }: PaymentDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0, hasMore: false });
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutSchedule | null>(null);

  // Loading states
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingPayoutSchedule, setLoadingPayoutSchedule] = useState(false);
  const [savingPayoutSchedule, setSavingPayoutSchedule] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchAccountStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/connect");
      const data = await response.json();

      if (!response.ok && response.status !== 404) {
        throw new Error(data.error || "Failed to fetch account status");
      }

      setAccountStatus({
        connected: data.connected || false,
        accountId: data.accountId || null,
        isActive: data.isActive || false,
        chargesEnabled: data.chargesEnabled || false,
        payoutsEnabled: data.payoutsEnabled || false,
        detailsSubmitted: data.detailsSubmitted || false,
        requirements: data.requirements,
      });
    } catch (error) {
      console.error("Failed to fetch account status:", error);
      setAccountStatus({
        connected: false,
        accountId: null,
        isActive: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/payments/summary");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch payment summary");
      }

      setSummary(data.data);
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (offset = 0) => {
    setLoadingTransactions(true);
    try {
      const response = await fetch(`/api/dashboard/payments/history?limit=10&offset=${offset}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transactions");
      }

      setTransactions(data.data.transactions);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  const fetchPayoutSchedule = useCallback(async () => {
    setLoadingPayoutSchedule(true);
    try {
      const response = await fetch("/api/dashboard/payments/payout-schedule");
      const data = await response.json();

      if (!response.ok) {
        // Not an error if Connect not configured
        if (response.status !== 400) {
          throw new Error(data.error || "Failed to fetch payout schedule");
        }
        return;
      }

      setPayoutSchedule(data.data);
    } catch (error) {
      console.error("Failed to fetch payout schedule:", error);
    } finally {
      setLoadingPayoutSchedule(false);
    }
  }, []);

  const updatePayoutSchedule = async (schedule: Partial<PayoutSchedule>) => {
    setSavingPayoutSchedule(true);
    try {
      const response = await fetch("/api/dashboard/payments/payout-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update payout schedule");
      }

      setPayoutSchedule(data.data);
      toast({
        title: "Payout Schedule Updated",
        description: "Your payout schedule has been saved.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update payout schedule",
        variant: "destructive",
      });
    } finally {
      setSavingPayoutSchedule(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAccountStatus();
    fetchSummary();
    fetchTransactions();
  }, [fetchAccountStatus, fetchSummary, fetchTransactions]);

  // Fetch payout schedule when account is connected and payouts enabled
  useEffect(() => {
    if (accountStatus?.connected && accountStatus?.payoutsEnabled) {
      fetchPayoutSchedule();
    }
  }, [accountStatus?.connected, accountStatus?.payoutsEnabled, fetchPayoutSchedule]);

  // Check for onboarding callback
  useEffect(() => {
    const onboarding = searchParams.get("onboarding");
    const refresh = searchParams.get("refresh");

    if (onboarding === "complete") {
      toast({
        title: "Onboarding Complete",
        description: "Your Stripe account has been connected successfully.",
        variant: "default",
      });
      // Remove query params and refresh data
      router.replace("/settings/payments");
      fetchAccountStatus();
      fetchSummary();
    } else if (refresh === "true") {
      // User was redirected back, refresh status
      fetchAccountStatus();
      router.replace("/settings/payments");
    }
  }, [searchParams, router, fetchAccountStatus, fetchSummary]);

  // ============================================
  // Actions
  // ============================================

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start Stripe Connect");
      }

      if (data.accountLink) {
        // Redirect to Stripe onboarding
        window.location.href = data.accountLink;
      } else if (data.needsOnboarding) {
        // Account exists but needs onboarding
        await handleContinueOnboarding();
      } else {
        // Account already connected
        toast({
          title: "Already Connected",
          description: "Your Stripe account is already connected.",
        });
        fetchAccountStatus();
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect Stripe",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/stripe/connect/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/settings/payments?onboarding=complete`,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get onboarding link");
      }

      window.location.href = data.accountLink;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to continue onboarding",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAccountStatus(), fetchSummary(), fetchTransactions()]);
    setRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Payment data has been updated.",
    });
  };

  const handlePageChange = (newOffset: number) => {
    fetchTransactions(newOffset);
  };

  // ============================================
  // Render Helpers
  // ============================================

  const renderAccountStatus = () => {
    if (loadingAccount) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      );
    }

    const isComplete = accountStatus?.chargesEnabled && accountStatus?.payoutsEnabled && accountStatus?.detailsSubmitted;
    const hasPendingRequirements = (accountStatus?.requirements?.currentlyDue?.length || 0) > 0;
    const hasPastDueRequirements = (accountStatus?.requirements?.pastDue?.length || 0) > 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#635bff]/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-[#635bff]" />
              </div>
              <div>
                <CardTitle>Stripe Connect</CardTitle>
                <CardDescription>
                  Accept payments and manage payouts
                </CardDescription>
              </div>
            </div>
            {accountStatus?.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!accountStatus?.connected ? (
            <>
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  Connect your Stripe account to accept deposits from customers when they book
                  appointments. Funds are transferred directly to your bank account.
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnectStripe} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect Stripe Account
              </Button>
            </>
          ) : !isComplete ? (
            <>
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Your Stripe account is connected but requires additional setup to start accepting payments.
                  {hasPastDueRequirements && (
                    <span className="block mt-1 font-medium">
                      Action required: Complete pending verification to avoid service interruption.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-3">
                <StatusIndicator
                  label="Details Submitted"
                  enabled={accountStatus.detailsSubmitted}
                />
                <StatusIndicator
                  label="Charges Enabled"
                  enabled={accountStatus.chargesEnabled}
                />
                <StatusIndicator
                  label="Payouts Enabled"
                  enabled={accountStatus.payoutsEnabled}
                />
              </div>
              <Button onClick={handleContinueOnboarding} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Complete Setup
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      Stripe Account Connected
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Account ID: {accountStatus.accountId}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <StatusIndicator label="Charges Enabled" enabled={true} />
                <StatusIndicator label="Payouts Enabled" enabled={true} />
                <StatusIndicator label="Verified" enabled={true} />
              </div>
              {hasPendingRequirements && (
                <Alert className="border-amber-500/50">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription>
                    There are {accountStatus.requirements?.currentlyDue?.length} pending verification items.
                    <Button
                      variant="link"
                      className="px-1 h-auto"
                      onClick={handleContinueOnboarding}
                    >
                      Complete verification
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Stripe Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderRevenueSummary = () => {
    if (loadingSummary || !summary?.connected) {
      if (loadingSummary) {
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStats key={i} />
            ))}
          </div>
        );
      }
      return null;
    }

    const periods = [
      { label: "Today", data: summary.today, icon: Clock },
      { label: "This Week", data: summary.thisWeek, icon: Calendar },
      { label: "This Month", data: summary.thisMonth, icon: TrendingUp },
      { label: "All Time", data: summary.allTime, icon: Banknote },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Revenue Overview</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {periods.map(({ label, data, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>{label}</CardDescription>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data ? formatCurrency(data.netRevenue) : "$0.00"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {data?.transactionCount || 0} transactions
                  </span>
                  {data && data.transactionCount > 0 && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-xs text-muted-foreground">
                        avg {formatCurrency(data.averageTransaction)}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderFeeBreakdown = () => {
    if (!summary?.connected || !summary.fees || !summary.thisMonth) {
      return null;
    }

    const { thisMonth, fees } = summary;
    const grossRevenue = thisMonth.grossRevenue;
    const platformFees = thisMonth.platformFees;
    const netAfterAllFees = grossRevenue - platformFees;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Fee Breakdown (This Month)</CardTitle>
              <CardDescription>Understanding your payment fees</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Gross Revenue</span>
              <span className="font-medium">{formatCurrency(grossRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({(fees.platformFeeRate * 100).toFixed(1)}%)
                </span>
              </div>
              <span className="text-red-600 dark:text-red-400">
                -{formatCurrency(platformFees)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="text-muted-foreground">Stripe Processing</span>
                <span className="text-xs text-muted-foreground ml-2">
                  (2.9% + $0.30)
                </span>
              </div>
              <span className="text-xs text-muted-foreground italic">
                (included in platform fee)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 bg-muted/50 rounded-lg px-3 -mx-3">
              <span className="font-medium">Net Earnings</span>
              <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                {formatCurrency(netAfterAllFees)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            The platform fee covers payment processing, fraud prevention, and dispute handling.
          </p>
        </CardContent>
      </Card>
    );
  };

  const renderPayoutSchedule = () => {
    if (!accountStatus?.connected || !accountStatus?.payoutsEnabled) {
      return null;
    }

    const weekDays = [
      { value: "monday", label: "Monday" },
      { value: "tuesday", label: "Tuesday" },
      { value: "wednesday", label: "Wednesday" },
      { value: "thursday", label: "Thursday" },
      { value: "friday", label: "Friday" },
      { value: "saturday", label: "Saturday" },
      { value: "sunday", label: "Sunday" },
    ];

    const monthDays = Array.from({ length: 31 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));

    const handleIntervalChange = (interval: string) => {
      const updates: Partial<PayoutSchedule> = { interval: interval as PayoutSchedule["interval"] };

      // Set defaults for anchors when switching intervals
      if (interval === "weekly" && !payoutSchedule?.weeklyAnchor) {
        updates.weeklyAnchor = "friday";
      }
      if (interval === "monthly" && !payoutSchedule?.monthlyAnchor) {
        updates.monthlyAnchor = 1;
      }

      updatePayoutSchedule(updates);
    };

    const handleWeeklyAnchorChange = (day: string) => {
      updatePayoutSchedule({ weeklyAnchor: day });
    };

    const handleMonthlyAnchorChange = (day: string) => {
      updatePayoutSchedule({ monthlyAnchor: parseInt(day, 10) });
    };

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Payout Schedule</CardTitle>
              <CardDescription>
                Configure when funds are transferred to your bank account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPayoutSchedule ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Payout Interval */}
              <div className="space-y-2">
                <Label htmlFor="payout-interval">Payout Frequency</Label>
                <Select
                  value={payoutSchedule?.interval || "daily"}
                  onValueChange={handleIntervalChange}
                  disabled={savingPayoutSchedule}
                >
                  <SelectTrigger id="payout-interval" className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {payoutSchedule?.interval === "manual"
                    ? "You'll need to manually request payouts from the Stripe Dashboard"
                    : payoutSchedule?.interval === "daily"
                    ? "Funds will be paid out every business day"
                    : payoutSchedule?.interval === "weekly"
                    ? "Funds will be paid out once per week"
                    : "Funds will be paid out once per month"}
                </p>
              </div>

              {/* Weekly Anchor */}
              {payoutSchedule?.interval === "weekly" && (
                <div className="space-y-2">
                  <Label htmlFor="weekly-anchor">Payout Day</Label>
                  <Select
                    value={payoutSchedule?.weeklyAnchor || "friday"}
                    onValueChange={handleWeeklyAnchorChange}
                    disabled={savingPayoutSchedule}
                  >
                    <SelectTrigger id="weekly-anchor" className="w-full">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Monthly Anchor */}
              {payoutSchedule?.interval === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="monthly-anchor">Payout Day of Month</Label>
                  <Select
                    value={String(payoutSchedule?.monthlyAnchor || 1)}
                    onValueChange={handleMonthlyAnchorChange}
                    disabled={savingPayoutSchedule}
                  >
                    <SelectTrigger id="monthly-anchor" className="w-full">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthDays.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If the month has fewer days, payout will occur on the last day
                  </p>
                </div>
              )}

              {/* Delay Days Info */}
              {payoutSchedule?.delayDays && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="font-medium">{payoutSchedule.delayDays} day</span> delay before funds are available
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    This is the standard processing time set by Stripe
                  </p>
                </div>
              )}

              {/* Saving Indicator */}
              {savingPayoutSchedule && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Saving...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPaymentHistory = () => {
    if (!accountStatus?.connected) {
      return null;
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Payment History</CardTitle>
                <CardDescription>Recent payments received through appointments</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {pagination.total} total payments
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={5} />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No payment transactions yet</p>
              <p className="text-sm mt-1">
                Payments will appear here when customers pay for appointments
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {tx.description || "Payment"}
                          </p>
                          {tx.customerEmail && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {tx.customerEmail}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getPaymentTypeBadge(tx.paymentType)}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(tx.amountCents, tx.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(tx.netAmountCents, tx.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          -{formatCurrency(tx.feeCents, tx.currency)} fee
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.offset + 1} to{" "}
                    {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                    {pagination.total} payments
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.offset - pagination.limit)}
                      disabled={pagination.offset === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                      disabled={!pagination.hasMore}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Stripe Connect Status */}
      {renderAccountStatus()}

      {/* Revenue Overview */}
      {renderRevenueSummary()}

      {/* Fee Breakdown */}
      {renderFeeBreakdown()}

      {/* Payout Schedule */}
      {renderPayoutSchedule()}

      {/* Payment History */}
      {renderPaymentHistory()}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function StatusIndicator({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background">
      {enabled ? (
        <CheckCircle className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}
