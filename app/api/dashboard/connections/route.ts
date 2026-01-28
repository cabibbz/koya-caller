/**
 * Connections API
 * GET /api/dashboard/connections — get connected account info
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api/auth-middleware";
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

export const GET = withAuth(async (_request, { business }) => {
  const supabase = createAdminClient();

  // Use maybeSingle() so missing rows return null instead of throwing
  const { data: integration, error: dbError } = await (supabase as any)
    .from("calendar_integrations")
    .select(
      "provider, grant_id, grant_email, grant_provider, grant_status, nylas_calendar_id, updated_at"
    )
    .eq("business_id", business.id)
    .maybeSingle();

  if (dbError) {
    logError("Connections API DB", dbError);
    return NextResponse.json(NOT_CONNECTED);
  }

  console.log("[Connections API] integration row:", JSON.stringify(integration));

  if (!integration?.grant_id || integration.grant_status !== "active") {
    return NextResponse.json(NOT_CONNECTED);
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
  });
});
