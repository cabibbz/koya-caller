/**
 * Nylas Calendar Client
 * Wraps Nylas SDK for calendar operations (events, free/busy)
 * Supports multiple calendar providers per business (Google + Microsoft)
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
  isPrimary?: boolean;
}

export interface CalendarIntegration {
  id: string;
  business_id: string;
  provider: string;
  grant_id: string | null;
  grant_email: string | null;
  grant_provider: string | null;
  grant_status: string;
  nylas_calendar_id: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get ALL Nylas grants for a business (multiple calendars)
 */
export async function getAllNylasGrants(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<NylasGrantInfo[]> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  const { data, error } = await client
    .from("calendar_integrations")
    .select("grant_id, grant_email, grant_provider, nylas_calendar_id, is_primary")
    .eq("business_id", businessId)
    .eq("grant_status", "active")
    .not("grant_id", "is", null);

  if (error) {
    logError("Nylas Grants", error);
    return [];
  }

  return (data || []).map((row) => ({
    grantId: row.grant_id,
    grantEmail: row.grant_email,
    grantProvider: row.grant_provider,
    calendarId: row.nylas_calendar_id || "primary",
    isPrimary: row.is_primary || false,
  }));
}

/**
 * Get the PRIMARY Nylas grant for a business (for availability checking)
 */
export async function getNylasGrant(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<NylasGrantInfo | null> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // First try to get the primary calendar
  const { data: primaryData } = await client
    .from("calendar_integrations")
    .select("grant_id, grant_email, grant_provider, nylas_calendar_id, is_primary")
    .eq("business_id", businessId)
    .eq("grant_status", "active")
    .eq("is_primary", true)
    .not("grant_id", "is", null)
    .single();

  if (primaryData?.grant_id) {
    return {
      grantId: primaryData.grant_id,
      grantEmail: primaryData.grant_email,
      grantProvider: primaryData.grant_provider,
      calendarId: primaryData.nylas_calendar_id || "primary",
      isPrimary: true,
    };
  }

  // Fallback to any active calendar
  const { data } = await client
    .from("calendar_integrations")
    .select("grant_id, grant_email, grant_provider, nylas_calendar_id, is_primary")
    .eq("business_id", businessId)
    .eq("grant_status", "active")
    .not("grant_id", "is", null)
    .limit(1)
    .single();

  if (!data?.grant_id) return null;

  return {
    grantId: data.grant_id,
    grantEmail: data.grant_email,
    grantProvider: data.grant_provider,
    calendarId: data.nylas_calendar_id || "primary",
    isPrimary: data.is_primary || false,
  };
}

/**
 * Get a specific Nylas grant by provider
 */
export async function getNylasGrantByProvider(
  businessId: string,
  provider: string,
  supabase?: AnySupabaseClient
): Promise<NylasGrantInfo | null> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;
  const mappedProvider = provider === "microsoft" ? "outlook" : provider;

  const { data } = await client
    .from("calendar_integrations")
    .select("grant_id, grant_email, grant_provider, nylas_calendar_id, is_primary")
    .eq("business_id", businessId)
    .eq("provider", mappedProvider)
    .eq("grant_status", "active")
    .not("grant_id", "is", null)
    .single();

  if (!data?.grant_id) return null;

  return {
    grantId: data.grant_id,
    grantEmail: data.grant_email,
    grantProvider: data.grant_provider,
    calendarId: data.nylas_calendar_id || "primary",
    isPrimary: data.is_primary || false,
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
 * Get free/busy times for ALL grants (combined busy times)
 */
export async function getFreeBusyAllGrants(
  businessId: string,
  startTime: number,
  endTime: number
): Promise<Array<{ start: number; end: number; provider: string }>> {
  const grants = await getAllNylasGrants(businessId);
  if (grants.length === 0) return [];

  const nylas = getNylasClient();
  const allBusyTimes: Array<{ start: number; end: number; provider: string }> = [];

  for (const grant of grants) {
    try {
      const response = await nylas.calendars.getFreeBusy({
        identifier: grant.grantId,
        requestBody: {
          startTime,
          endTime,
          emails: [grant.grantEmail],
        },
      });

      // Extract busy times from response
      const freeBusyData = response.data as Array<{
        email: string;
        timeSlots?: Array<{ startTime: number; endTime: number; status: string }>;
      }>;

      for (const fbEntry of freeBusyData) {
        if (fbEntry.timeSlots) {
          for (const slot of fbEntry.timeSlots) {
            if (slot.status === "busy") {
              allBusyTimes.push({
                start: slot.startTime,
                end: slot.endTime,
                provider: grant.grantProvider,
              });
            }
          }
        }
      }
    } catch (error) {
      logError("Nylas FreeBusy", `Failed for grant ${grant.grantId}: ${error}`);
    }
  }

  return allBusyTimes;
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
 * Get events for a date range from a single grant
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
 * Get events from ALL connected calendars for a business
 */
export async function getCalendarEventsFromAllGrants(
  businessId: string,
  startTime: number,
  endTime: number
): Promise<Array<{
  id: string;
  title: string;
  description: string;
  start: number;
  end: number;
  location: string;
  status: string;
  provider: string;
  calendarEmail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participants: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conferencing: any;
}>> {
  const grants = await getAllNylasGrants(businessId);
  if (grants.length === 0) return [];

  const allEvents: Array<{
    id: string;
    title: string;
    description: string;
    start: number;
    end: number;
    location: string;
    status: string;
    provider: string;
    calendarEmail: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conferencing: any;
  }> = [];

  for (const grant of grants) {
    try {
      const events = await getCalendarEvents(
        grant.grantId,
        grant.calendarId,
        startTime,
        endTime
      );

      for (const event of events) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = event as any;
        const when = e.when || {};

        allEvents.push({
          id: e.id,
          title: e.title || "",
          description: e.description || "",
          start: when.startTime ? when.startTime * 1000 : 0,
          end: when.endTime ? when.endTime * 1000 : 0,
          location: e.location || "",
          status: e.status || "confirmed",
          provider: grant.grantProvider,
          calendarEmail: grant.grantEmail,
          participants: e.participants || [],
          conferencing: e.conferencing || null,
        });
      }
    } catch (error) {
      logError("Nylas Events", `Failed for grant ${grant.grantId}: ${error}`);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => a.start - b.start);

  return allEvents;
}

/**
 * Store a Nylas grant after OAuth callback
 * Now supports multiple calendars - uses upsert with (business_id, provider) constraint
 */
export async function storeNylasGrant(
  businessId: string,
  grantId: string,
  email: string,
  provider: string
) {
  const mappedProvider = provider === "microsoft" ? "outlook" : provider;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Check if this provider already exists for this business
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/calendar_integrations?business_id=eq.${businessId}&provider=eq.${mappedProvider}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  const existingData = await checkRes.json();
  const exists = Array.isArray(existingData) && existingData.length > 0;

  if (exists) {
    // Update existing record for this provider
    const res = await fetch(
      `${supabaseUrl}/rest/v1/calendar_integrations?business_id=eq.${businessId}&provider=eq.${mappedProvider}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          grant_id: grantId,
          grant_email: email,
          grant_provider: provider,
          grant_status: "active",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      logError("Nylas Grant Store", `HTTP ${res.status}: ${errBody}`);
      throw new Error(`Failed to update grant: ${res.status}`);
    }

    const result = await res.json();
    logInfo("Nylas Grant", `Updated grant ${grantId} for business ${businessId}, provider: ${mappedProvider}`);
    return result;
  } else {
    // Insert new record for this provider
    const res = await fetch(
      `${supabaseUrl}/rest/v1/calendar_integrations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          business_id: businessId,
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
    logInfo("Nylas Grant", `Stored new grant ${grantId} for business ${businessId}, provider: ${mappedProvider}`);
    return result;
  }
}

/**
 * Update the calendar ID for a grant
 */
export async function updateGrantCalendarId(
  businessId: string,
  provider: string,
  calendarId: string
) {
  const supabase = createAdminClient() as AnySupabaseClient;
  const mappedProvider = provider === "microsoft" ? "outlook" : provider;

  const { error } = await supabase
    .from("calendar_integrations")
    .update({
      nylas_calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("provider", mappedProvider);

  if (error) {
    logError("Nylas Calendar ID Update", error);
    throw error;
  }
}

/**
 * Set a calendar as primary
 */
export async function setPrimaryCalendar(
  businessId: string,
  provider: string
) {
  const supabase = createAdminClient() as AnySupabaseClient;
  const mappedProvider = provider === "microsoft" ? "outlook" : provider;

  // First, unset all as non-primary
  await supabase
    .from("calendar_integrations")
    .update({ is_primary: false })
    .eq("business_id", businessId);

  // Then set the specified one as primary
  const { error } = await supabase
    .from("calendar_integrations")
    .update({ is_primary: true })
    .eq("business_id", businessId)
    .eq("provider", mappedProvider);

  if (error) {
    logError("Set Primary Calendar", error);
    throw error;
  }

  logInfo("Nylas Calendar", `Set ${mappedProvider} as primary for business ${businessId}`);
}

/**
 * Disconnect a specific Nylas grant by provider
 */
export async function disconnectNylasGrant(
  businessId: string,
  provider?: string
) {
  const supabase = createAdminClient() as AnySupabaseClient;

  if (provider) {
    // Disconnect specific provider
    const mappedProvider = provider === "microsoft" ? "outlook" : provider;

    const { error } = await supabase
      .from("calendar_integrations")
      .update({
        grant_id: null,
        grant_email: null,
        grant_provider: null,
        grant_status: "revoked",
        nylas_calendar_id: null,
        is_primary: false,
      })
      .eq("business_id", businessId)
      .eq("provider", mappedProvider);

    if (error) {
      logError("Nylas Disconnect", error);
      throw error;
    }

    logInfo("Nylas Grant", `Disconnected ${mappedProvider} for business ${businessId}`);
  } else {
    // Disconnect all calendars
    const { error } = await supabase
      .from("calendar_integrations")
      .update({
        grant_id: null,
        grant_email: null,
        grant_provider: null,
        grant_status: "revoked",
        nylas_calendar_id: null,
        is_primary: false,
      })
      .eq("business_id", businessId);

    if (error) {
      logError("Nylas Disconnect", error);
      throw error;
    }

    logInfo("Nylas Grant", `Disconnected all calendars for business ${businessId}`);
  }
}

/**
 * Get all calendar integrations for a business (full records)
 */
export async function getCalendarIntegrations(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<CalendarIntegration[]> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  const { data, error } = await client
    .from("calendar_integrations")
    .select("*")
    .eq("business_id", businessId)
    .eq("grant_status", "active")
    .not("grant_id", "is", null);

  if (error) {
    logError("Get Calendar Integrations", error);
    return [];
  }

  return data || [];
}
