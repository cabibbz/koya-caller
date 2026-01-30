/**
 * Connections API
 * GET /api/dashboard/connections — get connected account info + booking URL
 * PATCH /api/dashboard/connections — update booking page URL
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, success, errors, type BusinessAuthContext } from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const NOT_CONNECTED = {
  connected: false,
  provider: null,
  email: null,
  connectedAt: null,
  calendarId: null,
  features: { calendar: false, email: false, scheduler: false },
  calendars: [],
  folders: [],
};

async function handleGet(_request: NextRequest, { business, supabase }: BusinessAuthContext) {
  const adminSupabase = createAdminClient();

  // Get business booking URL and delivery preference
  const { data: businessData } = await (supabase as any)
    .from("businesses")
    .select("booking_page_url, booking_link_delivery")
    .eq("id", business.id)
    .single();

  // Use maybeSingle() so missing rows return null instead of throwing
  const { data: integration, error: dbError } = await (adminSupabase as any)
    .from("calendar_integrations")
    .select(
      "provider, grant_id, grant_email, grant_provider, grant_status, nylas_calendar_id, updated_at"
    )
    .eq("business_id", business.id)
    .maybeSingle();

  if (dbError) {
    logError("Connections API DB", dbError);
    return NextResponse.json({ ...NOT_CONNECTED, bookingPageUrl: businessData?.booking_page_url || null, bookingLinkDelivery: businessData?.booking_link_delivery || "sms" });
  }

  console.log("[Connections API] integration row:", JSON.stringify(integration));

  if (!integration?.grant_id || integration.grant_status !== "active") {
    return NextResponse.json({ ...NOT_CONNECTED, bookingPageUrl: businessData?.booking_page_url || null, bookingLinkDelivery: businessData?.booking_link_delivery || "sms" });
  }

  // Only attempt Nylas calls if API key is configured
  let calendars: any[] = [];
  let folders: any[] = [];

  if (process.env.NYLAS_API_KEY) {
    try {
      const { listCalendars } = await import("@/lib/nylas/calendar");
      const { listFolders } = await import("@/lib/nylas/messages");

      const [cals, fldrs] = await Promise.all([
        listCalendars(integration.grant_id).catch(() => []),
        listFolders(integration.grant_id).catch(() => []),
      ]);

      calendars = (cals || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        isPrimary: c.isPrimary ?? false,
        readOnly: c.readOnly ?? false,
      }));

      folders = fldrs || [];
    } catch (err) {
      logError("Connections API Nylas", err);
    }
  }

  return NextResponse.json({
    connected: true,
    provider: integration.grant_provider,
    email: integration.grant_email,
    connectedAt: integration.updated_at,
    calendarId: integration.nylas_calendar_id,
    features: {
      calendar: true,
      email: calendars.length > 0 || folders.length > 0,
      scheduler: true,
    },
    calendars,
    folders,
    bookingPageUrl: businessData?.booking_page_url || null,
    bookingLinkDelivery: businessData?.booking_link_delivery || "sms",
  });
}

async function handlePatch(request: NextRequest, { business, supabase }: BusinessAuthContext) {
  try {
    const body = await request.json();
    const { bookingPageUrl, bookingLinkDelivery } = body;

    // Validate URL if provided
    if (bookingPageUrl && typeof bookingPageUrl === "string" && bookingPageUrl.trim()) {
      try {
        new URL(bookingPageUrl);
      } catch {
        return errors.badRequest("Invalid URL format");
      }
    }

    // Validate delivery preference
    const validDeliveryOptions = ["sms", "email", "both"];
    if (bookingLinkDelivery && !validDeliveryOptions.includes(bookingLinkDelivery)) {
      return errors.badRequest("Invalid delivery option. Must be 'sms', 'email', or 'both'");
    }

    const updateData: Record<string, unknown> = {};
    if (bookingPageUrl !== undefined) {
      updateData.booking_page_url = bookingPageUrl?.trim() || null;
    }
    if (bookingLinkDelivery !== undefined) {
      updateData.booking_link_delivery = bookingLinkDelivery;
    }

    const { error } = await (supabase as any)
      .from("businesses")
      .update(updateData)
      .eq("id", business.id);

    if (error) {
      logError("Connections API PATCH", error);
      return errors.internalError("Failed to update booking URL");
    }

    return success({
      bookingPageUrl: bookingPageUrl?.trim() || null,
      bookingLinkDelivery: bookingLinkDelivery || "sms",
    });
  } catch (error) {
    logError("Connections API PATCH", error);
    return errors.internalError("Failed to update booking settings");
  }
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
