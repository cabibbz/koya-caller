/**
 * Nylas Webhook Handler
 * GET /api/nylas/webhooks - Challenge verification
 * POST /api/nylas/webhooks - Event processing
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyNylasWebhook, parseNylasWebhook } from "@/lib/nylas/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

/**
 * GET - Nylas webhook challenge verification
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
}

/**
 * POST - Process Nylas webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-nylas-signature") || "";

    // Verify signature if secret is configured
    if (process.env.NYLAS_WEBHOOK_SECRET) {
      if (!verifyNylasWebhook(rawBody, signature)) {
        logError("Nylas Webhook", "Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = parseNylasWebhook(JSON.parse(rawBody));
    if (!payload) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient() as AnySupabaseClient;

    switch (payload.type) {
      case "grant.expired":
      case "grant.deleted": {
        const grantId = payload.data.grant_id || (payload.data.object as Record<string, unknown>).id as string;
        if (grantId) {
          await supabase
            .from("calendar_integrations")
            .update({ grant_status: "expired" })
            .eq("grant_id", grantId);
          logInfo("Nylas Webhook", `Grant expired: ${grantId}`);
        }
        break;
      }

      case "grant.created": {
        const grantId = payload.data.grant_id || (payload.data.object as Record<string, unknown>).id as string;
        if (grantId) {
          await supabase
            .from("calendar_integrations")
            .update({ grant_status: "active" })
            .eq("grant_id", grantId);
          logInfo("Nylas Webhook", `Grant activated: ${grantId}`);
        }
        break;
      }

      case "booking.created": {
        const booking = payload.data.object as Record<string, unknown>;
        logInfo("Nylas Webhook", `Booking created: ${JSON.stringify(booking)}`);
        // TODO: Create appointment in Supabase from scheduler booking
        break;
      }

      case "booking.cancelled": {
        const booking = payload.data.object as Record<string, unknown>;
        const bookingId = booking.id as string;
        if (bookingId) {
          await supabase
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("nylas_booking_id", bookingId);
          logInfo("Nylas Webhook", `Booking cancelled: ${bookingId}`);
        }
        break;
      }

      case "booking.rescheduled": {
        const booking = payload.data.object as Record<string, unknown>;
        logInfo("Nylas Webhook", `Booking rescheduled: ${JSON.stringify(booking)}`);
        // TODO: Update appointment time from rescheduled booking
        break;
      }

      case "event.created":
      case "event.updated":
      case "event.deleted": {
        logInfo("Nylas Webhook", `Calendar event ${payload.type}: ${payload.id}`);
        // Calendar sync handled by existing Inngest job as fallback
        break;
      }

      default:
        logInfo("Nylas Webhook", `Unhandled event type: ${payload.type}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logError("Nylas Webhook", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
