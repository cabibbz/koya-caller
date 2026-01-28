/**
 * Nylas Webhook Handler
 * GET /api/nylas/webhooks - Challenge verification
 * POST /api/nylas/webhooks - Event processing
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyNylasWebhook, parseNylasWebhook } from "@/lib/nylas/webhooks";
import { listCalendars } from "@/lib/nylas/calendar";
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

    // Verify webhook signature — reject if secret is not configured
    if (!process.env.NYLAS_WEBHOOK_SECRET) {
      logError("Nylas Webhook", "NYLAS_WEBHOOK_SECRET not configured — rejecting webhook");
      return NextResponse.json({ error: "Webhook verification not configured" }, { status: 500 });
    }

    if (!verifyNylasWebhook(rawBody, signature)) {
      logError("Nylas Webhook", "Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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

          // Fetch and store primary calendar ID
          try {
            const calendars = await listCalendars(grantId);
            const primaryCal = calendars.find((c: any) => c.isPrimary) || calendars[0];
            if (primaryCal) {
              await supabase
                .from("calendar_integrations")
                .update({ nylas_calendar_id: primaryCal.id })
                .eq("grant_id", grantId);
              logInfo("Nylas Webhook", `Stored calendar ID ${primaryCal.id} for grant ${grantId}`);
            }
          } catch (calErr) {
            logError("Nylas Webhook", `Failed to fetch calendars for grant ${grantId}: ${calErr}`);
          }
        }
        break;
      }

      case "booking.created": {
        const booking = payload.data.object as Record<string, unknown>;
        logInfo("Nylas Webhook", `Booking created: ${JSON.stringify(booking)}`);

        try {
          const bookingId = booking.id as string;
          const grantId = payload.data.grant_id || (booking.grant_id as string);
          const title = (booking.title as string) || "Nylas Scheduler Booking";
          const startTime = booking.start_time as number | undefined;
          const endTime = booking.end_time as number | undefined;
          const customerName = (booking.name as string) || (booking.guest_name as string) || "Guest";
          const customerEmail = (booking.email as string) || (booking.guest_email as string) || null;
          const customerPhone = (booking.phone as string) || null;

          // Find business by grant
          const { data: integration } = await supabase
            .from("calendar_integrations")
            .select("business_id")
            .eq("grant_id", grantId)
            .single();

          if (integration && startTime && endTime) {
            await supabase
              .from("appointments")
              .insert({
                business_id: integration.business_id,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                start_time: new Date(startTime * 1000).toISOString(),
                end_time: new Date(endTime * 1000).toISOString(),
                status: "confirmed",
                source: "nylas_scheduler",
                nylas_booking_id: bookingId,
                notes: title,
              });
            logInfo("Nylas Webhook", `Created appointment from booking ${bookingId}`);
          }
        } catch (bookErr) {
          logError("Nylas Webhook", `Failed to create appointment from booking: ${bookErr}`);
        }
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

        try {
          const bookingId = booking.id as string;
          const startTime = booking.start_time as number | undefined;
          const endTime = booking.end_time as number | undefined;

          if (bookingId && startTime && endTime) {
            await supabase
              .from("appointments")
              .update({
                start_time: new Date(startTime * 1000).toISOString(),
                end_time: new Date(endTime * 1000).toISOString(),
                status: "confirmed",
              })
              .eq("nylas_booking_id", bookingId);
            logInfo("Nylas Webhook", `Updated appointment for rescheduled booking ${bookingId}`);
          }
        } catch (reschedErr) {
          logError("Nylas Webhook", `Failed to reschedule booking: ${reschedErr}`);
        }
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
