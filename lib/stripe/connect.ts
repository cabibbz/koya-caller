/**
 * Stripe Connect Integration for Koya Caller
 * Enables businesses to collect deposits and payments via destination charges
 *
 * Key patterns:
 * - Uses Stripe Connect Express accounts
 * - Destination charges: customer pays platform, platform takes fee, rest to connected account
 * - PCI compliant: uses Payment Links, never stores card data
 * - All amounts in cents for consistency
 */

import Stripe from "stripe";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";

// =============================================================================
// Types
// =============================================================================

export interface ConnectAccountParams {
  businessId: string;
  email: string;
  businessName?: string;
  businessType?: "individual" | "company";
}

export interface AccountLinkParams {
  accountId: string;
  returnUrl: string;
  refreshUrl?: string;
}

export interface AccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  created: Date;
}

export interface PaymentIntentParams {
  businessId: string;
  amountCents: number;
  description: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  appointmentId?: string;
  paymentType?: "deposit" | "balance" | "full";
}

export interface PaymentLinkParams {
  businessId: string;
  amountCents: number;
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  appointmentId?: string;
  paymentType?: "deposit" | "balance" | "full";
  successUrl?: string;
  cancelUrl?: string;
}

export interface DepositResult {
  success: boolean;
  paymentIntentId?: string;
  paymentLink?: string;
  clientSecret?: string;
  message: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amountCents?: number;
  status?: string;
  message: string;
}

export interface PayoutSchedule {
  interval: "manual" | "daily" | "weekly" | "monthly";
  weeklyAnchor?: string;
  monthlyAnchor?: number;
  delayDays: number;
}

export interface TransactionRecord {
  id: string;
  businessId: string;
  appointmentId?: string;
  stripePaymentIntentId: string;
  stripeTransferId?: string;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded";
  paymentType: "deposit" | "balance" | "full";
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Constants
// =============================================================================

// Platform fee as a percentage (e.g., 0.029 = 2.9%)
const PLATFORM_FEE_PERCENTAGE = 0.029;

// Minimum fee in cents
const MINIMUM_FEE_CENTS = 30;

// Default currency
const DEFAULT_CURRENCY = "usd";

// =============================================================================
// Connect Account Management
// =============================================================================

/**
 * Create a Stripe Connect Express account for a business
 * Express accounts handle onboarding, payouts, and disputes
 */
export async function createConnectAccount(
  params: ConnectAccountParams
): Promise<{ accountId: string; accountLink: string }> {
  const stripe = getStripe();
  const { businessId, email, businessName, businessType = "company" } = params;

  try {
    // Create the Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      email,
      business_type: businessType,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: businessName,
        mcc: "8999", // Professional services
      },
      metadata: {
        business_id: businessId,
        platform: "koya_caller",
      },
    });

    logInfo("Stripe Connect", `Created account ${account.id} for business ${businessId}`);

    // Store the account ID in the database
    const supabase = createAdminClient();
    await (supabase as any)
      .from("business_integrations")
      .upsert({
        business_id: businessId,
        provider: "stripe_connect",
        account_id: account.id,
        is_active: false, // Will be activated after onboarding
        metadata: {
          email,
          created_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "business_id,provider",
      });

    // Generate the account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?onboarding=complete`,
      type: "account_onboarding",
    });

    return {
      accountId: account.id,
      accountLink: accountLink.url,
    };
  } catch (error) {
    logError("Stripe Connect - Create Account", error);
    throw error;
  }
}

/**
 * Get an account link for onboarding or updating account details
 */
export async function getAccountLink(
  params: AccountLinkParams
): Promise<string> {
  const stripe = getStripe();
  const { accountId, returnUrl, refreshUrl } = params;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?refresh=true`,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Get the status of a Connect account
 */
export async function getAccountStatus(
  accountId: string
): Promise<AccountStatus> {
  const stripe = getStripe();

  const account = await stripe.accounts.retrieve(accountId);

  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: {
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
      pendingVerification: account.requirements?.pending_verification || [],
    },
    created: new Date((account.created || 0) * 1000),
  };
}

/**
 * Get Connect account for a business
 */
export async function getConnectAccountForBusiness(
  businessId: string
): Promise<{ accountId: string; isActive: boolean } | null> {
  const supabase = createAdminClient();

  const { data, error } = await (supabase as any)
    .from("business_integrations")
    .select("account_id, is_active")
    .eq("business_id", businessId)
    .eq("provider", "stripe_connect")
    .single();

  if (error || !data) {
    return null;
  }

  return {
    accountId: data.account_id,
    isActive: data.is_active,
  };
}

// =============================================================================
// Payment Processing (Destination Charges)
// =============================================================================

/**
 * Calculate platform fee for a transaction
 */
export function calculatePlatformFee(amountCents: number): number {
  const calculatedFee = Math.round(amountCents * PLATFORM_FEE_PERCENTAGE);
  return Math.max(calculatedFee, MINIMUM_FEE_CENTS);
}

/**
 * Create a PaymentIntent using destination charges
 * Customer pays platform, platform takes fee, rest goes to connected account
 */
export async function createPaymentIntent(
  params: PaymentIntentParams
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  const {
    businessId,
    amountCents,
    description,
    customerEmail,
    customerPhone,
    metadata = {},
    appointmentId,
    paymentType = "full",
  } = params;

  // Get the connected account
  const connectAccount = await getConnectAccountForBusiness(businessId);
  if (!connectAccount || !connectAccount.isActive) {
    throw new Error("Payment processing not configured for this business");
  }

  // Calculate platform fee
  const applicationFee = calculatePlatformFee(amountCents);

  // Create the PaymentIntent with destination charge
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: DEFAULT_CURRENCY,
    description,
    application_fee_amount: applicationFee,
    transfer_data: {
      destination: connectAccount.accountId,
    },
    receipt_email: customerEmail,
    metadata: {
      business_id: businessId,
      appointment_id: appointmentId || "",
      payment_type: paymentType,
      customer_phone: customerPhone || "",
      platform: "koya_caller",
      ...metadata,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Create a Payment Link for easy payment collection
 * PCI compliant - customer enters card details on Stripe-hosted page
 */
export async function createPaymentLink(
  params: PaymentLinkParams
): Promise<string> {
  const stripe = getStripe();
  const {
    businessId,
    amountCents,
    description,
    appointmentId,
    paymentType = "full",
    successUrl,
    cancelUrl: _cancelUrl,
  } = params;

  // Get the connected account
  const connectAccount = await getConnectAccountForBusiness(businessId);
  if (!connectAccount || !connectAccount.isActive) {
    throw new Error("Payment processing not configured for this business");
  }

  // Calculate platform fee
  const applicationFee = calculatePlatformFee(amountCents);

  // Create a price for this payment
  const product = await stripe.products.create({
    name: description,
    metadata: {
      business_id: businessId,
      appointment_id: appointmentId || "",
      payment_type: paymentType,
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: DEFAULT_CURRENCY,
  });

  // Create the payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    application_fee_amount: applicationFee,
    transfer_data: {
      destination: connectAccount.accountId,
    },
    after_completion: {
      type: "redirect",
      redirect: {
        url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?appointment=${appointmentId || ""}`,
      },
    },
    metadata: {
      business_id: businessId,
      appointment_id: appointmentId || "",
      payment_type: paymentType,
      platform: "koya_caller",
    },
  });

  return paymentLink.url;
}

// =============================================================================
// Deposit and Balance Collection
// =============================================================================

/**
 * Collect a deposit for an appointment
 */
export async function collectDeposit(
  appointmentId: string,
  amountCents: number
): Promise<DepositResult> {
  const supabase = createAdminClient();

  try {
    // Get appointment details
    const { data: appointment, error: aptError } = await (supabase as any)
      .from("appointments")
      .select("business_id, customer_email, customer_phone, service_name")
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      return {
        success: false,
        message: "Appointment not found",
      };
    }

    // Create payment link
    const paymentLink = await createPaymentLink({
      businessId: appointment.business_id,
      amountCents,
      description: `Deposit for ${appointment.service_name}`,
      customerEmail: appointment.customer_email,
      customerPhone: appointment.customer_phone,
      appointmentId,
      paymentType: "deposit",
    });

    // Record the pending payment
    await (supabase as any)
      .from("payment_transactions")
      .insert({
        business_id: appointment.business_id,
        appointment_id: appointmentId,
        amount_cents: amountCents,
        fee_cents: calculatePlatformFee(amountCents),
        net_amount_cents: amountCents - calculatePlatformFee(amountCents),
        currency: DEFAULT_CURRENCY,
        status: "pending",
        payment_type: "deposit",
        customer_email: appointment.customer_email,
        customer_phone: appointment.customer_phone,
        description: `Deposit for ${appointment.service_name}`,
        payment_link: paymentLink,
      });

    // Update appointment with deposit info
    await (supabase as any)
      .from("appointments")
      .update({
        deposit_amount_cents: amountCents,
        deposit_status: "pending",
        deposit_link: paymentLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    return {
      success: true,
      paymentLink,
      message: `Payment link created for $${(amountCents / 100).toFixed(2)} deposit`,
    };
  } catch (error) {
    logError("Stripe Connect - Collect Deposit", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create deposit link",
    };
  }
}

/**
 * Collect the remaining balance for an appointment
 */
export async function collectBalance(
  appointmentId: string
): Promise<DepositResult> {
  const supabase = createAdminClient();

  try {
    // Get appointment details with service price
    const { data: appointment, error: aptError } = await (supabase as any)
      .from("appointments")
      .select(`
        business_id,
        customer_email,
        customer_phone,
        service_name,
        service_id,
        deposit_amount_cents,
        deposit_status
      `)
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      return {
        success: false,
        message: "Appointment not found",
      };
    }

    // Get service price
    const { data: service } = await (supabase as any)
      .from("services")
      .select("price_cents")
      .eq("id", appointment.service_id)
      .single();

    if (!service?.price_cents) {
      return {
        success: false,
        message: "Service price not configured",
      };
    }

    // Calculate remaining balance
    const depositPaid = appointment.deposit_status === "paid" ? (appointment.deposit_amount_cents || 0) : 0;
    const balanceCents = service.price_cents - depositPaid;

    if (balanceCents <= 0) {
      return {
        success: true,
        message: "No balance due",
      };
    }

    // Create payment link for balance
    const paymentLink = await createPaymentLink({
      businessId: appointment.business_id,
      amountCents: balanceCents,
      description: `Balance for ${appointment.service_name}`,
      customerEmail: appointment.customer_email,
      customerPhone: appointment.customer_phone,
      appointmentId,
      paymentType: "balance",
    });

    // Record the pending payment
    await (supabase as any)
      .from("payment_transactions")
      .insert({
        business_id: appointment.business_id,
        appointment_id: appointmentId,
        amount_cents: balanceCents,
        fee_cents: calculatePlatformFee(balanceCents),
        net_amount_cents: balanceCents - calculatePlatformFee(balanceCents),
        currency: DEFAULT_CURRENCY,
        status: "pending",
        payment_type: "balance",
        customer_email: appointment.customer_email,
        customer_phone: appointment.customer_phone,
        description: `Balance for ${appointment.service_name}`,
        payment_link: paymentLink,
      });

    // Update appointment with balance info
    await (supabase as any)
      .from("appointments")
      .update({
        balance_amount_cents: balanceCents,
        balance_status: "pending",
        balance_link: paymentLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    return {
      success: true,
      paymentLink,
      message: `Payment link created for $${(balanceCents / 100).toFixed(2)} balance`,
    };
  } catch (error) {
    logError("Stripe Connect - Collect Balance", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create balance link",
    };
  }
}

// =============================================================================
// Refunds
// =============================================================================

/**
 * Refund a payment (full or partial)
 * Refunds reverse the transfer to the connected account
 */
export async function refundPayment(
  transactionId: string,
  amountCents?: number
): Promise<RefundResult> {
  const stripe = getStripe();
  const supabase = createAdminClient();

  try {
    // Get the transaction
    const { data: transaction, error: txError } = await (supabase as any)
      .from("payment_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      return {
        success: false,
        message: "Transaction not found",
      };
    }

    if (transaction.status !== "succeeded") {
      return {
        success: false,
        message: "Can only refund successful payments",
      };
    }

    // Determine refund amount
    const refundAmount = amountCents || transaction.amount_cents;

    // Create the refund
    const refund = await stripe.refunds.create({
      payment_intent: transaction.stripe_payment_intent_id,
      amount: refundAmount,
      reverse_transfer: true, // Reverse the transfer to connected account
      refund_application_fee: true, // Also refund the application fee
      metadata: {
        transaction_id: transactionId,
        business_id: transaction.business_id,
        appointment_id: transaction.appointment_id || "",
        platform: "koya_caller",
      },
    });

    // Update transaction status
    const isFullRefund = refundAmount === transaction.amount_cents;
    await (supabase as any)
      .from("payment_transactions")
      .update({
        status: isFullRefund ? "refunded" : "partially_refunded",
        refund_amount_cents: refundAmount,
        stripe_refund_id: refund.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    // Update appointment if applicable
    if (transaction.appointment_id) {
      const updateField = transaction.payment_type === "deposit" ? "deposit_status" : "balance_status";
      await (supabase as any)
        .from("appointments")
        .update({
          [updateField]: isFullRefund ? "refunded" : "partially_refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.appointment_id);
    }

    logInfo("Stripe Connect", `Refunded ${refundAmount} cents for transaction ${transactionId}`);

    return {
      success: true,
      refundId: refund.id,
      amountCents: refundAmount,
      status: refund.status || undefined,
      message: `Refunded $${(refundAmount / 100).toFixed(2)}`,
    };
  } catch (error) {
    logError("Stripe Connect - Refund", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process refund",
    };
  }
}

// =============================================================================
// Payout Management
// =============================================================================

/**
 * Get payout schedule for a connected account
 */
export async function getPayoutSchedule(
  accountId: string
): Promise<PayoutSchedule> {
  const stripe = getStripe();

  const account = await stripe.accounts.retrieve(accountId);
  const settings = account.settings?.payouts?.schedule;

  return {
    interval: (settings?.interval as PayoutSchedule["interval"]) || "daily",
    weeklyAnchor: settings?.weekly_anchor,
    monthlyAnchor: settings?.monthly_anchor,
    delayDays: settings?.delay_days || 2,
  };
}

/**
 * Update payout schedule for a connected account
 */
export async function updatePayoutSchedule(
  accountId: string,
  schedule: Partial<PayoutSchedule>
): Promise<PayoutSchedule> {
  const stripe = getStripe();

  const updateParams: Stripe.AccountUpdateParams = {
    settings: {
      payouts: {
        schedule: {
          interval: schedule.interval,
          weekly_anchor: schedule.weeklyAnchor as Stripe.AccountUpdateParams.Settings.Payouts.Schedule.WeeklyAnchor,
          monthly_anchor: schedule.monthlyAnchor,
          delay_days: schedule.delayDays,
        },
      },
    },
  };

  const account = await stripe.accounts.update(accountId, updateParams);
  const settings = account.settings?.payouts?.schedule;

  logInfo("Stripe Connect", `Updated payout schedule for account ${accountId}`);

  return {
    interval: (settings?.interval as PayoutSchedule["interval"]) || "daily",
    weeklyAnchor: settings?.weekly_anchor,
    monthlyAnchor: settings?.monthly_anchor,
    delayDays: settings?.delay_days || 2,
  };
}

// =============================================================================
// Reporting
// =============================================================================

/**
 * Get payment transactions for a business
 */
export async function getPaymentTransactions(
  businessId: string,
  options?: {
    appointmentId?: string;
    status?: TransactionRecord["status"];
    paymentType?: TransactionRecord["paymentType"];
    limit?: number;
    offset?: number;
  }
): Promise<TransactionRecord[]> {
  const supabase = createAdminClient();
  const { appointmentId, status, paymentType, limit = 50, offset = 0 } = options || {};

  let query = (supabase as any)
    .from("payment_transactions")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (appointmentId) {
    query = query.eq("appointment_id", appointmentId);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (paymentType) {
    query = query.eq("payment_type", paymentType);
  }

  const { data, error } = await query;

  if (error) {
    logError("Stripe Connect - Get Transactions", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    businessId: row.business_id,
    appointmentId: row.appointment_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeTransferId: row.stripe_transfer_id,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    netAmountCents: row.net_amount_cents,
    currency: row.currency,
    status: row.status,
    paymentType: row.payment_type,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Get payment summary for a business
 */
export async function getPaymentSummary(
  businessId: string,
  dateRange?: { start: Date; end: Date }
): Promise<{
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  depositCount: number;
  balanceCount: number;
}> {
  const supabase = createAdminClient();

  let query = (supabase as any)
    .from("payment_transactions")
    .select("amount_cents, fee_cents, net_amount_cents, payment_type")
    .eq("business_id", businessId)
    .eq("status", "succeeded");

  if (dateRange) {
    query = query
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      totalRevenue: 0,
      totalFees: 0,
      netRevenue: 0,
      transactionCount: 0,
      averageTransaction: 0,
      depositCount: 0,
      balanceCount: 0,
    };
  }

  const transactions = data as Array<{
    amount_cents: number;
    fee_cents: number;
    net_amount_cents: number;
    payment_type: string;
  }>;

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount_cents, 0);
  const totalFees = transactions.reduce((sum, t) => sum + t.fee_cents, 0);
  const netRevenue = transactions.reduce((sum, t) => sum + t.net_amount_cents, 0);
  const depositCount = transactions.filter((t) => t.payment_type === "deposit").length;
  const balanceCount = transactions.filter((t) => t.payment_type === "balance").length;

  return {
    totalRevenue,
    totalFees,
    netRevenue,
    transactionCount: transactions.length,
    averageTransaction: transactions.length > 0 ? Math.round(totalRevenue / transactions.length) : 0,
    depositCount,
    balanceCount,
  };
}
