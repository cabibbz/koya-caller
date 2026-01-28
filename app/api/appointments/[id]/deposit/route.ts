/**
 * Appointment Deposit API
 * POST: Create payment intent/link for deposit
 * GET: Get deposit status for appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  collectDeposit,
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
 * POST /api/appointments/[id]/deposit
 * Create a payment link for collecting deposit
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
      .select("id, business_id, customer_phone, customer_name, service_name, deposit_status")
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
      deposit_status: string | null;
    };

    // Check if deposit already paid
    if (apt.deposit_status === "paid") {
      return NextResponse.json(
        { error: "Deposit already paid" },
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

    // Get deposit settings
    const { data: paymentSettings } = await (supabase as any)
      .from("payment_settings")
      .select("deposit_type, deposit_amount_cents, deposit_percentage")
      .eq("business_id", biz.id)
      .single();

    // Parse request body for optional custom amount
    let amountCents: number;
    try {
      const body = await request.json();
      if (body.amount_cents && typeof body.amount_cents === "number" && body.amount_cents > 0) {
        amountCents = Math.round(body.amount_cents);
      } else if (paymentSettings) {
        // Use configured deposit settings
        if (paymentSettings.deposit_type === "percentage") {
          // Get service price
          const { data: servicePrice } = await (supabase as any)
            .from("services")
            .select("price_cents")
            .eq("business_id", biz.id)
            .ilike("name", apt.service_name)
            .single();

          if (servicePrice?.price_cents) {
            amountCents = Math.round(
              (servicePrice.price_cents * paymentSettings.deposit_percentage) / 100
            );
          } else {
            amountCents = paymentSettings.deposit_amount_cents || 5000;
          }
        } else {
          amountCents = paymentSettings.deposit_amount_cents || 5000;
        }
      } else {
        // Default to $50
        amountCents = 5000;
      }
    } catch {
      // Use default if body parsing fails
      amountCents = paymentSettings?.deposit_amount_cents || 5000;
    }

    // Create deposit payment link
    const result = await collectDeposit(appointmentId, amountCents);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Send payment link via SMS if customer has phone
    if (apt.customer_phone && result.paymentLink) {
      try {
        await sendSMS({
          to: apt.customer_phone,
          body: `Hi ${apt.customer_name || "there"}! Here's your secure payment link for your $${(amountCents / 100).toFixed(2)} deposit at ${biz.name}: ${result.paymentLink}`,
          messageType: "booking_confirmation",
          businessId: biz.id,
        });
        logInfo("Deposit", `Sent payment link SMS to ${apt.customer_phone.slice(-4)}`);
      } catch (smsError) {
        logError("Deposit - SMS", smsError);
        // Don't fail the request if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      amountCents,
      message: result.message,
    });
  } catch (error) {
    logError("Appointment Deposit - POST", error);
    return NextResponse.json(
      { error: "Failed to create deposit link" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/appointments/[id]/deposit
 * Get deposit status for an appointment
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
        deposit_amount_cents,
        deposit_status,
        deposit_link
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
      deposit_amount_cents: number | null;
      deposit_status: string | null;
      deposit_link: string | null;
    };

    // Get deposit transactions
    const transactions = await getPaymentTransactions(biz.id, {
      appointmentId,
      paymentType: "deposit",
    });

    return NextResponse.json({
      success: true,
      data: {
        appointmentId,
        depositAmountCents: apt.deposit_amount_cents,
        status: apt.deposit_status || "none",
        paymentLink: apt.deposit_link,
        transactions,
      },
    });
  } catch (error) {
    logError("Appointment Deposit - GET", error);
    return NextResponse.json(
      { error: "Failed to get deposit status" },
      { status: 500 }
    );
  }
}
