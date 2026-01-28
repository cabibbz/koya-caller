/**
 * Payment Settings API
 * GET: Fetch payment/deposit settings
 * PUT: Update deposit configuration
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getConnectAccountForBusiness,
  getAccountStatus,
  getPayoutSchedule,
  getPaymentSummary,
} from "@/lib/stripe/connect";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - Fetch payment settings and Stripe Connect status
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Get payment settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paymentSettings } = await (supabase as any)
      .from("payment_settings")
      .select("*")
      .eq("business_id", business.id)
      .single();

    // Get Connect account status
    let connectStatus = null;
    let payoutSchedule = null;
    let paymentSummary = null;

    const connectAccount = await getConnectAccountForBusiness(business.id);
    if (connectAccount) {
      try {
        const status = await getAccountStatus(connectAccount.accountId);
        connectStatus = {
          accountId: connectAccount.accountId,
          isActive: connectAccount.isActive,
          chargesEnabled: status.chargesEnabled,
          payoutsEnabled: status.payoutsEnabled,
          detailsSubmitted: status.detailsSubmitted,
          requirements: status.requirements,
        };

        if (status.payoutsEnabled) {
          payoutSchedule = await getPayoutSchedule(connectAccount.accountId);
        }

        // Get payment summary for this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        paymentSummary = await getPaymentSummary(business.id, {
          start: startOfMonth,
          end: now,
        });
      } catch (error) {
        logError("Payment Settings - Connect Status", error);
      }
    }

    // Build Stripe status in the format the component expects
    const stripeStatus = {
      connected: !!connectStatus,
      account_id: connectStatus?.accountId || null,
      charges_enabled: connectStatus?.chargesEnabled || false,
      payouts_enabled: connectStatus?.payoutsEnabled || false,
      details_submitted: connectStatus?.detailsSubmitted || false,
      onboarding_complete: connectStatus ? (connectStatus.chargesEnabled && connectStatus.detailsSubmitted) : false,
    };

    // Build deposit settings in the format the component expects
    const depositSettings = {
      deposits_enabled: paymentSettings?.deposit_enabled || false,
      deposit_type: (paymentSettings?.deposit_type as "fixed" | "percentage" | "full") || "fixed",
      fixed_amount_cents: paymentSettings?.deposit_amount_cents || 5000,
      percentage_amount: paymentSettings?.deposit_percentage || 25,
      collect_on_call: paymentSettings?.collect_on_call || false,
      require_card_on_file: paymentSettings?.require_deposit_for_booking || false,
    };

    // Build payout settings
    const payoutSettings = {
      payout_schedule: (payoutSchedule?.interval as "daily" | "weekly" | "monthly" | "manual") || "daily",
    };

    // Build payment summary
    const summary = {
      total_collected_cents: paymentSummary?.totalRevenue || 0,
      total_payouts_cents: paymentSummary?.netRevenue || 0,
      pending_balance_cents: (paymentSummary?.totalRevenue || 0) - (paymentSummary?.netRevenue || 0),
      currency: "usd",
    };

    return success({
      stripe: stripeStatus,
      deposits: depositSettings,
      payouts: payoutSettings,
      summary: summary,
    });
  } catch (error) {
    logError("Payment Settings - GET", error);
    return errors.internalError("Failed to fetch payment settings");
  }
}

// =============================================================================
// PUT Handler - Update deposit configuration
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    // Validate settings
    const allowedFields = [
      "deposit_enabled",
      "deposit_type",
      "deposit_amount_cents",
      "deposit_percentage",
      "auto_collect_balance",
      "balance_collect_days_before",
      "require_deposit_for_booking",
      "send_payment_reminders",
      "reminder_hours_before",
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      business_id: business.id,
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Validate specific fields
        if (field === "deposit_type" && !["fixed", "percentage"].includes(body[field])) {
          return errors.badRequest("deposit_type must be 'fixed' or 'percentage'");
        }
        if (field === "deposit_amount_cents" && (typeof body[field] !== "number" || body[field] < 0)) {
          return errors.badRequest("deposit_amount_cents must be a positive number");
        }
        if (field === "deposit_percentage" && (typeof body[field] !== "number" || body[field] < 0 || body[field] > 100)) {
          return errors.badRequest("deposit_percentage must be between 0 and 100");
        }

        updateData[field] = body[field];
      }
    }

    // Check if Stripe Connect is set up before enabling deposits
    if (body.deposit_enabled || body.require_deposit_for_booking) {
      const connectAccount = await getConnectAccountForBusiness(business.id);
      if (!connectAccount || !connectAccount.isActive) {
        return errors.badRequest("Stripe Connect must be configured before enabling deposits");
      }
    }

    // Upsert payment settings (using admin client for elevated permissions)
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings, error: updateError } = await (adminSupabase as any)
      .from("payment_settings")
      .upsert(updateData, {
        onConflict: "business_id",
      })
      .select()
      .single();

    if (updateError) {
      logError("Payment Settings - Update", updateError);
      return errors.internalError("Failed to update payment settings");
    }

    return success(settings);
  } catch (error) {
    logError("Payment Settings - PUT", error);
    return errors.internalError("Failed to update payment settings");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
