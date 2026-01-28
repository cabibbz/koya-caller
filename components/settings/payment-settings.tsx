"use client";

/**
 * Payment Settings Component
 * Stripe Connect Integration and Deposit Collection
 * Phase 3: Payment/Deposit Features
 */

import { useState, useEffect } from "react";
import {
  CreditCard,
  Loader2,
  Save,
  ExternalLink,
  Check,
  AlertCircle,
  DollarSign,
  Percent,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

interface StripeConnectStatus {
  connected: boolean;
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
}

type DepositType = "fixed" | "percentage" | "full";
type PayoutSchedule = "daily" | "weekly" | "monthly" | "manual";

interface DepositSettings {
  deposits_enabled: boolean;
  deposit_type: DepositType;
  fixed_amount_cents: number;
  percentage_amount: number;
  collect_on_call: boolean;
  require_card_on_file: boolean;
}

interface PayoutSettings {
  payout_schedule: PayoutSchedule;
}

interface PaymentSummary {
  total_collected_cents: number;
  total_payouts_cents: number;
  pending_balance_cents: number;
  currency: string;
}

interface PaymentSettings {
  stripe: StripeConnectStatus;
  deposits: DepositSettings;
  payouts: PayoutSettings;
  summary: PaymentSummary;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  stripe: {
    connected: false,
    account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    onboarding_complete: false,
  },
  deposits: {
    deposits_enabled: false,
    deposit_type: "fixed",
    fixed_amount_cents: 5000, // $50 default
    percentage_amount: 25,
    collect_on_call: false,
    require_card_on_file: false,
  },
  payouts: {
    payout_schedule: "daily",
  },
  summary: {
    total_collected_cents: 0,
    total_payouts_cents: 0,
    pending_balance_cents: 0,
    currency: "usd",
  },
};

// ============================================
// Component
// ============================================

export function PaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/payments");
      const data = await response.json();

      if (!response.ok) {
        if (response.status !== 404) {
          throw new Error(data.error || "Failed to fetch payment settings");
        }
      }

      if (data.data) {
        // Merge with defaults to ensure all properties exist
        const merged: PaymentSettings = {
          stripe: { ...DEFAULT_SETTINGS.stripe, ...data.data.stripe },
          deposits: { ...DEFAULT_SETTINGS.deposits, ...data.data.deposits },
          payouts: { ...DEFAULT_SETTINGS.payouts, ...data.data.payouts },
          summary: { ...DEFAULT_SETTINGS.summary, ...data.data.summary },
        };
        setSettings(merged);
        setOriginalSettings(merged);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Check for OAuth callback result
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const stripeConnected = urlParams.get("stripe_connected");
      const stripeError = urlParams.get("stripe_error");

      if (stripeConnected === "true") {
        toast({
          title: "Stripe Connected",
          description: "Your Stripe account has been successfully connected",
          variant: "success",
        });
        window.history.replaceState({}, "", window.location.pathname);
        fetchSettings();
      } else if (stripeError) {
        toast({
          title: "Connection Failed",
          description: decodeURIComponent(stripeError),
          variant: "destructive",
        });
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      // Silently fail - OAuth callback check is best-effort
    }
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  // ============================================
  // Actions
  // ============================================

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deposits: settings.deposits,
          payouts: settings.payouts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setOriginalSettings(settings);
      setHasChanges(false);

      toast({
        title: "Saved",
        description: "Payment settings updated successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/integrations/stripe/connect");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start Stripe Connect");
      }

      // Redirect to Stripe Connect OAuth
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect Stripe",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/integrations/stripe/connect/onboarding");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get onboarding link");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to continue onboarding",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/integrations/stripe/connect/status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh status");
      }

      setSettings((prev) => ({
        ...prev,
        stripe: data.data,
      }));

      toast({
        title: "Status Refreshed",
        description: "Stripe account status has been updated",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh status",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const updateDepositSetting = <K extends keyof DepositSettings>(
    key: K,
    value: DepositSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      deposits: { ...prev.deposits, [key]: value },
    }));
  };

  const updatePayoutSetting = <K extends keyof PayoutSettings>(
    key: K,
    value: PayoutSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      payouts: { ...prev.payouts, [key]: value },
    }));
  };

  // ============================================
  // Helper Functions
  // ============================================

  const formatCurrency = (cents: number, currency = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { stripe, deposits, payouts, summary } = settings;
  const canConfigureDeposits = stripe.connected && stripe.charges_enabled;

  return (
    <div className="space-y-6">
      {/* Stripe Connect Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#635bff]/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-[#635bff]" />
              </div>
              <div>
                <CardTitle>Stripe Connect</CardTitle>
                <CardDescription>
                  Connect your Stripe account to collect deposits from customers
                </CardDescription>
              </div>
            </div>
            {stripe.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stripe.connected ? (
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
          ) : !stripe.onboarding_complete ? (
            <>
              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  Your Stripe account is connected but onboarding is incomplete.
                  Complete the setup to start accepting payments.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-4">
                <Button onClick={handleCompleteOnboarding} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Complete Onboarding
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Stripe Account Connected
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Account ID: {stripe.account_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                  {stripe.charges_enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Charges {stripe.charges_enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                  {stripe.payouts_enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Payouts {stripe.payouts_enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                  {stripe.details_submitted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Details {stripe.details_submitted ? "Submitted" : "Pending"}</span>
                </div>
              </div>

              {!stripe.charges_enabled && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Charges are not enabled for your account. Please complete any pending
                    requirements in your Stripe dashboard.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deposit Settings
              </CardTitle>
              <CardDescription>
                Configure deposit requirements for appointments
              </CardDescription>
            </div>
            {canConfigureDeposits && (
              <Button onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!canConfigureDeposits ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connect and verify your Stripe account to configure deposit settings.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Enable Deposits */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="font-medium">Enable Deposits</Label>
                    <p className="text-sm text-muted-foreground">
                      Require customers to pay a deposit when booking
                    </p>
                  </div>
                </div>
                <Switch
                  checked={deposits.deposits_enabled}
                  onCheckedChange={(checked) =>
                    updateDepositSetting("deposits_enabled", checked)
                  }
                />
              </div>

              {deposits.deposits_enabled && (
                <>
                  {/* Deposit Type */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Deposit Type</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          deposits.deposit_type === "fixed"
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/50"
                        }`}
                        onClick={() => updateDepositSetting("deposit_type", "fixed")}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-5 w-5" />
                          <span className="font-medium">Fixed Amount</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Same deposit for all bookings
                        </p>
                      </div>
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          deposits.deposit_type === "percentage"
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/50"
                        }`}
                        onClick={() => updateDepositSetting("deposit_type", "percentage")}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="h-5 w-5" />
                          <span className="font-medium">Percentage</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Percentage of service price
                        </p>
                      </div>
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          deposits.deposit_type === "full"
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/50"
                        }`}
                        onClick={() => updateDepositSetting("deposit_type", "full")}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="h-5 w-5" />
                          <span className="font-medium">Full Payment</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Collect full service price
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amount Input */}
                  {deposits.deposit_type === "fixed" && (
                    <div className="space-y-2">
                      <Label htmlFor="fixed-amount">Fixed Amount ($)</Label>
                      <div className="relative w-48">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fixed-amount"
                          type="number"
                          min={1}
                          step={0.01}
                          value={(deposits.fixed_amount_cents / 100).toFixed(2)}
                          onChange={(e) =>
                            updateDepositSetting(
                              "fixed_amount_cents",
                              Math.round(parseFloat(e.target.value || "0") * 100)
                            )
                          }
                          className="pl-8"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The fixed deposit amount charged for all bookings
                      </p>
                    </div>
                  )}

                  {deposits.deposit_type === "percentage" && (
                    <div className="space-y-2">
                      <Label htmlFor="percentage-amount">Percentage (%)</Label>
                      <div className="relative w-32">
                        <Input
                          id="percentage-amount"
                          type="number"
                          min={1}
                          max={100}
                          value={deposits.percentage_amount}
                          onChange={(e) =>
                            updateDepositSetting(
                              "percentage_amount",
                              parseInt(e.target.value, 10) || 25
                            )
                          }
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Percentage of the service price to collect (1-100%)
                      </p>
                    </div>
                  )}

                  {/* Additional Options */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Additional Options</Label>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Collect Payment on Call</Label>
                        <p className="text-xs text-muted-foreground">
                          AI will collect payment details during the call
                        </p>
                      </div>
                      <Switch
                        checked={deposits.collect_on_call}
                        onCheckedChange={(checked) =>
                          updateDepositSetting("collect_on_call", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Require Card on File</Label>
                        <p className="text-xs text-muted-foreground">
                          Customers must save a card to complete booking
                        </p>
                      </div>
                      <Switch
                        checked={deposits.require_card_on_file}
                        onCheckedChange={(checked) =>
                          updateDepositSetting("require_card_on_file", checked)
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout Settings Card */}
      {canConfigureDeposits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Payout Schedule
            </CardTitle>
            <CardDescription>
              Configure how often you receive payouts from collected deposits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-schedule">Payout Frequency</Label>
              <Select
                value={payouts.payout_schedule}
                onValueChange={(value: PayoutSchedule) =>
                  updatePayoutSetting("payout_schedule", value)
                }
              >
                <SelectTrigger id="payout-schedule" className="w-48">
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {payouts.payout_schedule === "daily" &&
                  "Funds are transferred to your bank account every business day"}
                {payouts.payout_schedule === "weekly" &&
                  "Funds are transferred to your bank account every week"}
                {payouts.payout_schedule === "monthly" &&
                  "Funds are transferred to your bank account once per month"}
                {payouts.payout_schedule === "manual" &&
                  "You manually initiate payouts from your Stripe dashboard"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary Card */}
      {canConfigureDeposits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Summary
            </CardTitle>
            <CardDescription>
              Overview of collected payments and payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.total_collected_cents, summary.currency)}
                </p>
                <p className="text-sm text-muted-foreground">Total Collected</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold">
                  {formatCurrency(summary.total_payouts_cents, summary.currency)}
                </p>
                <p className="text-sm text-muted-foreground">Total Payouts</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(summary.pending_balance_cents, summary.currency)}
                </p>
                <p className="text-sm text-muted-foreground">Pending Balance</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Stripe Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
