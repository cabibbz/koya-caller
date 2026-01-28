/**
 * Nylas Calendar Client
 * Wraps Nylas SDK for calendar operations (events, free/busy)
 */

import { getNylasClient } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface NylasGrantInfo {
  grantId: string;
  grantEmail: string;
  grantProvider: string;
  calendarId: string;
}

/**
 * Get the Nylas grant info for a business
 */
export async function getNylasGrant(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<NylasGrantInfo | null> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  const { data } = await client
    .from("calendar_integrations")
    .select("grant_id, grant_email, grant_provider, nylas_calendar_id")
    .eq("business_id", businessId)
    .eq("grant_status", "active")
    .single();

  if (!data?.grant_id) return null;

  return {
    grantId: data.grant_id,
    grantEmail: data.grant_email,
    grantProvider: data.grant_provider,
    calendarId: data.nylas_calendar_id || "primary",
  };
}

/**
 * List calendars for a connected account
 */
export async function listCalendars(grantId: string) {
  const nylas = getNylasClient();
  const response = await nylas.calendars.list({ identifier: grantId });
  return response.data;
}

/**
 * Get free/busy times for a grant
 */
export async function getFreeBusy(
  grantId: string,
  email: string,
  startTime: number,
  endTime: number
) {
  const nylas = getNylasClient();
  const response = await nylas.calendars.getFreeBusy({
    identifier: grantId,
    requestBody: {
      startTime,
      endTime,
      emails: [email],
    },
  });
  return response.data;
}

/**
 * Create a calendar event (appointment)
 */
export async function createCalendarEvent(
  grantId: string,
  calendarId: string,
  params: {
    title: string;
    description?: string;
    startTime: number; // Unix seconds
    endTime: number;
    timezone: string;
    attendees?: Array<{ name: string; email: string }>;
    location?: string;
    conferencing?: boolean;
    provider?: string;
  }
) {
  const nylas = getNylasClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: any = {
    title: params.title,
    description: params.description || "",
    when: {
      startTime: params.startTime,
      endTime: params.endTime,
      startTimezone: params.timezone,
      endTimezone: params.timezone,
    },
    participants: params.attendees?.map((a) => ({
      name: a.name,
      email: a.email,
    })) || [],
  };

  if (params.location) {
    requestBody.location = params.location;
  }

  if (params.conferencing) {
    const conferencingProvider = params.provider === "microsoft" ? "Microsoft Teams" : "Google Meet";
    requestBody.conferencing = {
      provider: conferencingProvider,
      autocreate: {},
    };
  }

  const response = await nylas.events.create({
    identifier: grantId,
    requestBody,
    queryParams: { calendarId },
  });

  logInfo("Nylas Calendar", `Created event: ${response.data.id}`);
  return response.data;
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  grantId: string,
  calendarId: string,
  eventId: string
) {
  const nylas = getNylasClient();
  await nylas.events.destroy({
    identifier: grantId,
    eventId,
    queryParams: { calendarId },
  });
  logInfo("Nylas Calendar", `Deleted event: ${eventId}`);
}

/**
 * Get events for a date range
 */
export async function getCalendarEvents(
  grantId: string,
  calendarId: string,
  startTime: number,
  endTime: number
) {
  const nylas = getNylasClient();
  const response = await nylas.events.list({
    identifier: grantId,
    queryParams: {
      calendarId,
      start: startTime.toString(),
      end: endTime.toString(),
    },
  });
  return response.data;
}

/**
 * Store a Nylas grant after OAuth callback
 */
export async function storeNylasGrant(
  businessId: string,
  grantId: string,
  email: string,
  provider: string
) {
  const mappedProvider = provider === "microsoft" ? "outlook" : provider;

  // Use direct Supabase Management API / pg connection to bypass PostgREST schema cache
  // PostgREST may silently drop columns it doesn't know about after migration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use PostgREST PATCH (update) with explicit headers
  const res = await fetch(
    `${supabaseUrl}/rest/v1/calendar_integrations?business_id=eq.${businessId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        provider: mappedProvider,
        grant_id: grantId,
        grant_email: email,
        grant_provider: provider,
        grant_status: "active",
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    logError("Nylas Grant Store", `HTTP ${res.status}: ${errBody}`);
    throw new Error(`Failed to store grant: ${res.status}`);
  }

  const result = await res.json();
  logInfo("Nylas Grant", `Stored grant ${grantId} for business ${businessId}, rows updated: ${result.length}`);
}

/**
 * Disconnect a Nylas grant
 */
export async function disconnectNylasGrant(businessId: string) {
  const supabase = createAdminClient() as AnySupabaseClient;

  const { error } = await supabase
    .from("calendar_integrations")
    .update({
      grant_id: null,
      grant_email: null,
      grant_provider: null,
      grant_status: "revoked",
      nylas_calendar_id: null,
    })
    .eq("business_id", businessId);

  if (error) {
    logError("Nylas Disconnect", error);
    throw error;
  }

  logInfo("Nylas Grant", `Disconnected grant for business ${businessId}`);
}
