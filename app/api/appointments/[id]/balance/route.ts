/**
 * Appointment Balance API
 * POST: Collect remaining balance after service
 * GET: Get balance status for appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  collectBalance,
  createPaymentLink,
  getConnectAccountForBusiness,
  getPaymentTransactions,
} from "@/lib/stripe/connect";
import { sendSMS } from "@/lib/twilio";
import { logError, logInfo } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/appointments/[id]/balance
 * Create a payment link for collecting remaining balance
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limit check
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rateLimitResult = await checkRateLimit("dashboard", ip);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const { id: appointmentId } = await context.params;

    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as { id: string; name: string };

    // Verify appointment belongs to business
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select(`
        id,
        business_id,
        customer_phone,
        customer_name,
        service_name,
        service_id,
        balance_status,
        deposit_status,
        deposit_amount_cents
      `)
      .eq("id", appointmentId)
      .eq("business_id", biz.id)
      .single();

    if (aptError || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const apt = appointment as {
      id: string;
      business_id: string;
      customer_phone: string;
      customer_name: string;
      service_name: string;
      service_id: string;
      balance_status: string | null;
      deposit_status: string | null;
      deposit_amount_cents: number | null;
    };

    // Check if balance already paid
    if (apt.balance_status === "paid") {
      return NextResponse.json(
        { error: "Balance already paid" },
        { status: 400 }
      );
    }

    // Check if Stripe Connect is configured
    const connectAccount = await getConnectAccountForBusiness(biz.id);
    if (!connectAccount || !connectAccount.isActive) {
      return NextResponse.json(
        { error: "Payment processing not configured" },
        { status: 400 }
      );
    }

    // Check for custom amount in request body
    let customAmountCents: number | undefined;
    try {
      const body = await request.json();
      if (body.amount_cents && typeof body.amount_cents === "number" && body.amount_cents > 0) {
        customAmountCents = Math.round(body.amount_cents);
      }
    } catch {
      // No custom amount
    }

    // If custom amount provided, use it; otherwise calculate from service price
    let paymentLink: string | undefined;
    let amountCents: number | undefined;
    let message: string;

    if (customAmountCents) {
      paymentLink = await createPaymentLink({
        businessId: biz.id,
        amountCents: customAmountCents,
        description: `Balance for ${apt.service_name}`,
        customerPhone: apt.customer_phone,
        appointmentId,
        paymentType: "balance",
      });

      // Update appointment
      await (supabase as any)
        .from("appointments")
        .update({
          balance_amount_cents: customAmountCents,
          balance_status: "pending",
          balance_link: paymentLink,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      amountCents = customAmountCents;
      message = `Payment link created for $${(customAmountCents / 100).toFixed(2)} balance`;
    } else {
      // Use standard collectBalance which calculates from service price
      const result = await collectBalance(appointmentId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      paymentLink = result.paymentLink;
      message = result.message;
    }

    // Send payment link via SMS if customer has phone
    if (apt.customer_phone && paymentLink) {
      try {
        const amountStr = amountCents
          ? `$${(amountCents / 100).toFixed(2)} `
          : "";
        await sendSMS({
          to: apt.customer_phone,
          body: `Hi ${apt.customer_name || "there"}! Here's your secure payment link for your ${amountStr}balance at ${biz.name}: ${paymentLink}`,
          messageType: "booking_confirmation",
          businessId: biz.id,
        });
        logInfo("Balance", `Sent payment link SMS to ${apt.customer_phone.slice(-4)}`);
      } catch (smsError) {
        logError("Balance - SMS", smsError);
        // Don't fail the request if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      paymentLink,
      amountCents,
      message,
    });
  } catch (error) {
    logError("Appointment Balance - POST", error);
    return NextResponse.json(
      { error: "Failed to create balance link" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/appointments/[id]/balance
 * Get balance status for an appointment
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limit check
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rateLimitResult = await checkRateLimit("dashboard", ip);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const { id: appointmentId } = await context.params;

    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as { id: string };

    // Verify appointment belongs to business
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select(`
        id,
        business_id,
        service_id,
        deposit_amount_cents,
        deposit_status,
        balance_amount_cents,
        balance_status,
        balance_link
      `)
      .eq("id", appointmentId)
      .eq("business_id", biz.id)
      .single();

    if (aptError || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const apt = appointment as {
      id: string;
      business_id: string;
      service_id: string;
      deposit_amount_cents: number | null;
      deposit_status: string | null;
      balance_amount_cents: number | null;
      balance_status: string | null;
      balance_link: string | null;
    };

    // Get service price
    let servicePriceCents = 0;
    if (apt.service_id) {
      const { data: service } = await supabase
        .from("services")
        .select("price_cents")
        .eq("id", apt.service_id)
        .single();

      if (service) {
        servicePriceCents = (service as { price_cents: number }).price_cents || 0;
      }
    }

    // Calculate remaining balance
    const depositPaid = apt.deposit_status === "paid" ? (apt.deposit_amount_cents || 0) : 0;
    const balancePaid = apt.balance_status === "paid" ? (apt.balance_amount_cents || 0) : 0;
    const remainingBalance = Math.max(0, servicePriceCents - depositPaid - balancePaid);

    // Get balance transactions
    const transactions = await getPaymentTransactions(biz.id, {
      appointmentId,
      paymentType: "balance",
    });

    return NextResponse.json({
      success: true,
      data: {
        appointmentId,
        servicePriceCents,
        depositPaidCents: depositPaid,
        balanceAmountCents: apt.balance_amount_cents,
        status: apt.balance_status || "none",
        remainingBalanceCents: remainingBalance,
        paymentLink: apt.balance_link,
        transactions,
      },
    });
  } catch (error) {
    logError("Appointment Balance - GET", error);
    return NextResponse.json(
      { error: "Failed to get balance status" },
      { status: 500 }
    );
  }
}
