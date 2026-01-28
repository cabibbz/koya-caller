/**
 * Stripe Connect Webhook Handler
 * Handles Connect-specific events:
 * - account.updated (onboarding status changes)
 * - account.application.deauthorized (disconnect)
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - transfer.created
 * - transfer.reversed (handles transfer failures)
 * - payout.paid
 * - payout.failed
 * - charge.refunded
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { logError, logInfo, logWarning } from "@/lib/logging";
import type Stripe from "stripe";

// Environment variable for Connect webhook secret (separate from main webhook)
const CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

/**
 * POST /api/stripe/connect/webhook
 * Handle Stripe Connect webhook events
 */
export async function POST(request: NextRequest) {
  // Get raw payload for signature verification
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 401 }
    );
  }

  if (!CONNECT_WEBHOOK_SECRET) {
    logError("Stripe Connect Webhook", "STRIPE_CONNECT_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  // Verify signature
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      CONNECT_WEBHOOK_SECRET
    );
  } catch (err) {
    logError("Stripe Connect Webhook - Signature", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      // =======================================================================
      // Account Events
      // =======================================================================
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }

      case "account.application.deauthorized": {
        // The object is an Application, but we need account ID from event.account
        const application = event.data.object as Stripe.Application;
        await handleAccountDeauthorized(supabase, application, event.account);
        break;
      }

      // =======================================================================
      // Payment Intent Events
      // =======================================================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabase, paymentIntent);
        break;
      }

      // =======================================================================
      // Transfer Events (platform to connected account)
      // =======================================================================
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(supabase, transfer);
        break;
      }

      case "transfer.reversed": {
        // Handle transfer reversal (acts as transfer failure)
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferFailed(supabase, transfer);
        break;
      }

      // =======================================================================
      // Payout Events (connected account to bank)
      // =======================================================================
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutPaid(supabase, payout, event.account);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(supabase, payout, event.account);
        break;
      }

      // =======================================================================
      // Charge Events (for refunds)
      // =======================================================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, charge);
        break;
      }

      default:
        // Unhandled event type - ignore silently
        break;
    }
  } catch (error) {
    logError("Stripe Connect Webhook - Handler", error);
    // Return 500 so Stripe retries
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle account.updated event
 * Update business integration status when onboarding completes
 */
async function handleAccountUpdated(
  supabase: ReturnType<typeof createAdminClient>,
  account: Stripe.Account
) {
  const businessId = account.metadata?.business_id;

  if (!businessId) {
    logWarning("Stripe Connect Webhook", `Account ${account.id} has no business_id metadata`);
    return;
  }

  const isActive =
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted;

  // Update business integration status
  const { error } = await (supabase as any)
    .from("business_integrations")
    .update({
      is_active: isActive,
      metadata: {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements_due: account.requirements?.currently_due || [],
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", account.id)
    .eq("provider", "stripe_connect");

  if (error) {
    logError("Stripe Connect Webhook - Update Account", error);
  } else {
    logInfo("Stripe Connect Webhook", `Account ${account.id} updated: active=${isActive}`);
  }
}

/**
 * Handle account.application.deauthorized event
 * Business has disconnected their Stripe account from our platform
 */
async function handleAccountDeauthorized(
  supabase: ReturnType<typeof createAdminClient>,
  _application: Stripe.Application,
  accountId?: string
) {
  if (!accountId) {
    logWarning("Stripe Connect Webhook", "Deauthorization event missing account ID");
    return;
  }

  logWarning("Stripe Connect Webhook", `Account ${accountId} has been deauthorized`);

  // Find and update the business integration
  const { data: integration, error: fetchError } = await (supabase as any)
    .from("business_integrations")
    .select("business_id")
    .eq("account_id", accountId)
    .eq("provider", "stripe_connect")
    .single();

  if (fetchError || !integration) {
    logWarning("Stripe Connect Webhook", `No integration found for deauthorized account ${accountId}`);
    return;
  }

  // Mark the integration as inactive and deauthorized
  const { error: updateError } = await (supabase as any)
    .from("business_integrations")
    .update({
      is_active: false,
      metadata: {
        deauthorized: true,
        deauthorized_at: new Date().toISOString(),
        charges_enabled: false,
        payouts_enabled: false,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId)
    .eq("provider", "stripe_connect");

  if (updateError) {
    logError("Stripe Connect Webhook - Deauthorize Account", updateError);
  }

  // Notify business owner about disconnection
  try {
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id, name, users!inner(email)")
      .eq("id", integration.business_id)
      .single();

    if (!business?.users?.email) {
      logWarning("Stripe Connect Webhook", `No owner email for business ${integration.business_id}`);
      return;
    }

    const { sendStripeDisconnectEmail } = await import("@/lib/email");
    const reconnectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.koyacaller.com"}/settings/payments`;

    await sendStripeDisconnectEmail({
      to: business.users.email,
      businessName: business.name,
      stripeAccountId: accountId,
      reconnectUrl,
    });

    logInfo("Stripe Connect Webhook", `Disconnection notification sent to ${business.users.email}`);
  } catch (emailError) {
    logError("Stripe Connect Webhook - Disconnect Notification", emailError);
  }

  logInfo("Stripe Connect Webhook", `Account ${accountId} deauthorized for business ${integration.business_id}`);
}

/**
 * Handle payment_intent.succeeded event
 * Update transaction and appointment records
 */
async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata || {};
  const businessId = metadata.business_id;
  const appointmentId = metadata.appointment_id;
  const paymentType = metadata.payment_type as "deposit" | "balance" | "full";

  if (!businessId) {
    logWarning("Stripe Connect Webhook", `PaymentIntent ${paymentIntent.id} has no business_id`);
    return;
  }

  // Update or create transaction record
  const { data: transaction, error: txError } = await (supabase as any)
    .from("payment_transactions")
    .upsert({
      business_id: businessId,
      appointment_id: appointmentId || null,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      application_fee_cents: paymentIntent.application_fee_amount || 0,
      currency: paymentIntent.currency,
      status: "succeeded",
      payment_type: paymentType || "full",
      customer_email: paymentIntent.receipt_email || metadata.customer_email,
      customer_phone: metadata.customer_phone,
      description: paymentIntent.description,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_payment_intent_id",
    })
    .select("id")
    .single();

  if (txError) {
    logError("Stripe Connect Webhook - Update Transaction", txError);
  }

  const transactionId = transaction?.id || null;
  const paidAt = new Date().toISOString();

  // Update appointment payment status if applicable
  if (appointmentId) {
    let appointmentUpdate: Record<string, unknown> = {
      updated_at: paidAt,
    };

    if (paymentType === "deposit") {
      // Deposit payment: mark deposit as paid
      appointmentUpdate = {
        ...appointmentUpdate,
        deposit_paid_at: paidAt,
        deposit_amount_cents: paymentIntent.amount,
        deposit_transaction_id: transactionId,
      };
    } else if (paymentType === "balance") {
      // Balance payment: mark balance as paid
      appointmentUpdate = {
        ...appointmentUpdate,
        balance_paid_at: paidAt,
        balance_amount_cents: paymentIntent.amount,
        balance_transaction_id: transactionId,
      };
    } else {
      // Full payment: mark both deposit and balance as paid
      appointmentUpdate = {
        ...appointmentUpdate,
        deposit_paid_at: paidAt,
        deposit_amount_cents: paymentIntent.amount,
        deposit_transaction_id: transactionId,
        balance_paid_at: paidAt,
        balance_amount_cents: 0, // No remaining balance
        balance_transaction_id: transactionId,
      };
    }

    const { error: aptError } = await (supabase as any)
      .from("appointments")
      .update(appointmentUpdate)
      .eq("id", appointmentId);

    if (aptError) {
      logError("Stripe Connect Webhook - Update Appointment Payment Status", aptError);
    } else {
      logInfo("Stripe Connect Webhook", `Appointment ${appointmentId} payment status updated: ${paymentType} paid`);
    }
  }

  logInfo("Stripe Connect Webhook", `Payment succeeded: ${paymentIntent.id} for business ${businessId}`);
}

/**
 * Handle payment_intent.payment_failed event
 * Updates transaction status and notifies business owner
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata || {};
  const businessId = metadata.business_id;
  const appointmentId = metadata.appointment_id;
  const paymentType = metadata.payment_type as "deposit" | "balance" | "full";

  if (!businessId) {
    logWarning("Stripe Connect Webhook", `PaymentIntent ${paymentIntent.id} has no business_id`);
    return;
  }

  // Update transaction record
  const { error: txError } = await (supabase as any)
    .from("payment_transactions")
    .upsert({
      business_id: businessId,
      appointment_id: appointmentId || null,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      application_fee_cents: 0,
      currency: paymentIntent.currency,
      status: "failed",
      payment_type: paymentType || "full",
      failure_reason: paymentIntent.last_payment_error?.message,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_payment_intent_id",
    });

  if (txError) {
    logError("Stripe Connect Webhook - Update Failed Transaction", txError);
  }

  // Note: We don't clear appointment payment fields on failure
  // The payment simply remains unpaid (deposit_paid_at/balance_paid_at stay null)
  // This allows customers to retry payment without losing appointment data

  logWarning("Stripe Connect Webhook", `Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message}`);

  // Notify business owner about payment failure
  try {
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id, name, users!inner(email)")
      .eq("id", businessId)
      .single();

    if (!business?.users?.email) {
      logWarning("Stripe Connect Webhook", `No owner email for business ${businessId}`);
      return;
    }

    const { sendPaymentFailedEmail } = await import("@/lib/email");
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.koyacaller.com"}/settings/payments`;

    await sendPaymentFailedEmail({
      to: business.users.email,
      businessName: business.name,
      amountCents: paymentIntent.amount,
      currency: paymentIntent.currency,
      failureCode: paymentIntent.last_payment_error?.code || null,
      failureMessage: paymentIntent.last_payment_error?.message || null,
      customerEmail: metadata.customer_email || paymentIntent.receipt_email,
      appointmentId: appointmentId || undefined,
      dashboardUrl,
    });

    logInfo("Stripe Connect Webhook", `Payment failure notification sent to ${business.users.email}`);
  } catch (emailError) {
    logError("Stripe Connect Webhook - Payment Failure Notification", emailError);
  }
}

/**
 * Handle transfer.created event
 * Track transfers to connected accounts and record in database
 */
async function handleTransferCreated(
  supabase: ReturnType<typeof createAdminClient>,
  transfer: Stripe.Transfer
) {
  const destinationAccountId = typeof transfer.destination === "string"
    ? transfer.destination
    : transfer.destination?.id;

  // Record the transfer in connect_transfers table
  const { error: insertError } = await (supabase as any)
    .from("connect_transfers")
    .upsert({
      stripe_transfer_id: transfer.id,
      stripe_account_id: destinationAccountId,
      amount_cents: transfer.amount,
      currency: transfer.currency,
      status: "created",
      source_transaction: transfer.source_transaction
        ? (typeof transfer.source_transaction === "string" ? transfer.source_transaction : transfer.source_transaction)
        : null,
      description: transfer.description,
      metadata: transfer.metadata,
      created_at: new Date(transfer.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_transfer_id",
    });

  if (insertError) {
    logError("Stripe Connect Webhook - Record Transfer", insertError);
  }

  // Link transfer to payment transaction if source exists
  const sourceTransaction = transfer.source_transaction;
  if (sourceTransaction) {
    const sourceId = typeof sourceTransaction === "string" ? sourceTransaction : sourceTransaction;

    // Try to find by charge ID first, then by payment intent
    const { error: updateError } = await (supabase as any)
      .from("payment_transactions")
      .update({
        stripe_transfer_id: transfer.id,
        transfer_status: "created",
        updated_at: new Date().toISOString(),
      })
      .or(`stripe_charge_id.eq.${sourceId},stripe_payment_intent_id.eq.${sourceId}`);

    if (updateError) {
      // Not a critical error - transaction may not exist or may be linked differently
      logWarning("Stripe Connect Webhook", `Could not link transfer ${transfer.id} to source ${sourceId}`);
    }
  }

  logInfo("Stripe Connect Webhook", `Transfer created: ${transfer.id} - ${transfer.amount} ${transfer.currency} to ${destinationAccountId}`);
}

/**
 * Handle transfer.failed or transfer.reversed event
 * Updates transfer status and notifies business owner
 */
async function handleTransferFailed(
  supabase: ReturnType<typeof createAdminClient>,
  transfer: Stripe.Transfer
) {
  const destinationAccountId = typeof transfer.destination === "string"
    ? transfer.destination
    : transfer.destination?.id;

  logError("Stripe Connect Webhook", `Transfer failed/reversed: ${transfer.id}`);

  // Update transfer record in database
  const { error: updateTransferError } = await (supabase as any)
    .from("connect_transfers")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (updateTransferError) {
    logWarning("Stripe Connect Webhook", `Could not update transfer ${transfer.id} status`);
  }

  // Update linked payment transaction
  const { error: updateTxError } = await (supabase as any)
    .from("payment_transactions")
    .update({
      transfer_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (updateTxError) {
    logWarning("Stripe Connect Webhook", `Could not update transaction for transfer ${transfer.id}`);
  }

  // Notify business owner about transfer failure
  if (destinationAccountId) {
    try {
      const { data: integration } = await (supabase as any)
        .from("business_integrations")
        .select("business_id")
        .eq("account_id", destinationAccountId)
        .eq("provider", "stripe_connect")
        .single();

      if (!integration?.business_id) {
        logWarning("Stripe Connect Webhook", `No business found for account ${destinationAccountId}`);
        return;
      }

      const { data: business } = await (supabase as any)
        .from("businesses")
        .select("id, name, users!inner(email)")
        .eq("id", integration.business_id)
        .single();

      if (!business?.users?.email) {
        logWarning("Stripe Connect Webhook", `No owner email for business ${integration.business_id}`);
        return;
      }

      const { sendTransferFailedEmail } = await import("@/lib/email");
      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.koyacaller.com"}/settings/payments`;

      await sendTransferFailedEmail({
        to: business.users.email,
        businessName: business.name,
        amountCents: transfer.amount,
        currency: transfer.currency,
        transferId: transfer.id,
        dashboardUrl,
      });

      logInfo("Stripe Connect Webhook", `Transfer failure notification sent to ${business.users.email}`);
    } catch (emailError) {
      logError("Stripe Connect Webhook - Transfer Failure Notification", emailError);
    }
  }
}

/**
 * Handle payout.paid event
 * Track successful payouts to business bank accounts
 */
async function handlePayoutPaid(
  supabase: ReturnType<typeof createAdminClient>,
  payout: Stripe.Payout,
  accountId?: string
) {
  if (!accountId) {
    logWarning("Stripe Connect Webhook", `Payout ${payout.id} has no account ID`);
    return;
  }

  // Upsert payout record to handle status updates
  const { error } = await (supabase as any)
    .from("connect_payouts")
    .upsert({
      stripe_account_id: accountId,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      currency: payout.currency,
      status: "paid",
      arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
      method: payout.method,
      type: payout.type,
      description: payout.description,
      bank_account_last4: payout.destination
        ? (typeof payout.destination === "string" ? null : (payout.destination as any).last4)
        : null,
      paid_at: new Date().toISOString(),
      created_at: new Date(payout.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_payout_id",
    });

  if (error) {
    logError("Stripe Connect Webhook - Record Payout", error);
  }

  logInfo("Stripe Connect Webhook", `Payout paid: ${payout.id} - ${payout.amount} ${payout.currency} to account ${accountId}`);
}

/**
 * Handle payout.failed event
 * Records failure and notifies business owner
 */
async function handlePayoutFailed(
  supabase: ReturnType<typeof createAdminClient>,
  payout: Stripe.Payout,
  accountId?: string
) {
  if (!accountId) {
    logWarning("Stripe Connect Webhook", `Failed payout ${payout.id} has no account ID`);
    return;
  }

  // Upsert failed payout record
  const { error } = await (supabase as any)
    .from("connect_payouts")
    .upsert({
      stripe_account_id: accountId,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      currency: payout.currency,
      status: "failed",
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
      method: payout.method,
      type: payout.type,
      created_at: new Date(payout.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_payout_id",
    });

  if (error) {
    logError("Stripe Connect Webhook - Record Failed Payout", error);
  }

  logError("Stripe Connect Webhook", `Payout failed: ${payout.id} - ${payout.failure_message}`);

  // Send notification to business owner about failed payout
  try {
    const { data: integration } = await (supabase as any)
      .from("business_integrations")
      .select("business_id")
      .eq("account_id", accountId)
      .eq("provider", "stripe_connect")
      .single();

    if (!integration?.business_id) {
      logWarning("Stripe Connect Webhook", `No business found for account ${accountId}`);
      return;
    }

    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id, name, users!inner(email)")
      .eq("id", integration.business_id)
      .single();

    if (!business?.users?.email) {
      logWarning("Stripe Connect Webhook", `No owner email for business ${integration.business_id}`);
      return;
    }

    const { sendPayoutFailedEmail } = await import("@/lib/email");
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://app.koyacaller.com"}/settings/payments`;

    await sendPayoutFailedEmail({
      to: business.users.email,
      businessName: business.name,
      amountCents: payout.amount,
      currency: payout.currency,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
      stripeAccountId: accountId,
      dashboardUrl,
    });

    logInfo("Stripe Connect Webhook", `Payout failure notification sent to ${business.users.email}`);
  } catch (emailError) {
    logError("Stripe Connect Webhook - Payout Notification", emailError);
  }
}

/**
 * Handle charge.refunded event
 * Updates transaction status and records refund details
 */
async function handleChargeRefunded(
  supabase: ReturnType<typeof createAdminClient>,
  charge: Stripe.Charge
) {
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    logWarning("Stripe Connect Webhook", `Refunded charge ${charge.id} has no payment_intent`);
    return;
  }

  const isFullRefund = charge.refunded;
  const newStatus = isFullRefund ? "refunded" : "partially_refunded";
  const paymentIntentIdStr = typeof paymentIntentId === "string" ? paymentIntentId : paymentIntentId;

  // Update the payment transaction with refund details
  const { error: updateError, data: updatedTx } = await (supabase as any)
    .from("payment_transactions")
    .update({
      status: newStatus,
      refunded_amount_cents: charge.amount_refunded,
      stripe_charge_id: charge.id,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentIdStr)
    .select("business_id, appointment_id, payment_type")
    .single();

  if (updateError) {
    logError("Stripe Connect Webhook - Update Refund", updateError);
  }

  // If there's an associated appointment and it's a full refund, clear the payment status
  if (updatedTx?.appointment_id && isFullRefund) {
    const paymentType = updatedTx.payment_type as "deposit" | "balance" | "full" | null;
    let appointmentUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (paymentType === "deposit") {
      // Refund deposit: clear deposit payment fields
      appointmentUpdate = {
        ...appointmentUpdate,
        deposit_paid_at: null,
        deposit_amount_cents: null,
        deposit_transaction_id: null,
      };
    } else if (paymentType === "balance") {
      // Refund balance: clear balance payment fields
      appointmentUpdate = {
        ...appointmentUpdate,
        balance_paid_at: null,
        balance_amount_cents: null,
        balance_transaction_id: null,
      };
    } else {
      // Full payment refund: clear all payment fields
      appointmentUpdate = {
        ...appointmentUpdate,
        deposit_paid_at: null,
        deposit_amount_cents: null,
        deposit_transaction_id: null,
        balance_paid_at: null,
        balance_amount_cents: null,
        balance_transaction_id: null,
      };
    }

    const { error: aptError } = await (supabase as any)
      .from("appointments")
      .update(appointmentUpdate)
      .eq("id", updatedTx.appointment_id);

    if (aptError) {
      logError("Stripe Connect Webhook - Clear Appointment Payment Status", aptError);
    } else {
      logInfo("Stripe Connect Webhook", `Appointment ${updatedTx.appointment_id} payment status cleared due to refund`);
    }
  }

  // Record refund in a separate refunds table for detailed tracking
  if (charge.refunds?.data && charge.refunds.data.length > 0) {
    const latestRefund = charge.refunds.data[0];
    await (supabase as any)
      .from("payment_refunds")
      .upsert({
        stripe_refund_id: latestRefund.id,
        stripe_charge_id: charge.id,
        stripe_payment_intent_id: paymentIntentIdStr,
        business_id: updatedTx?.business_id || null,
        amount_cents: latestRefund.amount,
        currency: latestRefund.currency,
        status: latestRefund.status,
        reason: latestRefund.reason,
        created_at: new Date((latestRefund.created || Date.now() / 1000) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "stripe_refund_id",
      });
  }

  logInfo("Stripe Connect Webhook", `Charge refunded: ${charge.id} - ${charge.amount_refunded} cents (${newStatus})`);
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
