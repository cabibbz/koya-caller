/**
 * Calendar Integration Module
 * Session 20: Calendar OAuth & Sync
 * 
 * Unified interface for calendar operations across providers.
 * Supports: Google Calendar, Outlook/Microsoft Graph, Built-in
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarClient, CalendarProvider, OAuthTokens, FreeBusyResponse, CalendarEvent, CreateEventInput, CalendarInfo } from "./types";
import { CalendarAuthError } from "./types";
import {
  getNylasGrant,
  getFreeBusy as nylasGetFreeBusy,
  createCalendarEvent as nylasCreateEvent,
  getCalendarEvents as nylasGetEvents,
  deleteCalendarEvent as nylasDeleteEvent,
  listCalendars as nylasListCalendars,
  disconnectNylasGrant,
} from "@/lib/nylas/calendar";

// Re-export types
export * from "./types";

// ============================================
// State Token Management
// ============================================

/**
 * Generate a secure state token for OAuth
 */
export function generateOAuthState(
  businessId: string,
  returnUrl: string
): string {
  const nonce = crypto.randomUUID();
  const state = {
    businessId,
    returnUrl,
    nonce,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

/**
 * Parse and validate OAuth state token
 */
export function parseOAuthState(state: string): {
  businessId: string;
  returnUrl: string;
  nonce: string;
  timestamp: number;
} | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);

    // Validate required fields
    if (!parsed.businessId || !parsed.returnUrl || !parsed.nonce) {
      return null;
    }

    // Check if state is not too old (15 minutes max)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - parsed.timestamp > maxAge) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ============================================
// Calendar Client Factory
// ============================================

/**
 * Create a Nylas-backed CalendarClient adapter for a business.
 * Falls back to legacy Google/Outlook direct clients if no Nylas grant exists.
 */
function createNylasCalendarAdapter(
  grantId: string,
  grantEmail: string,
  calendarId: string,
  timezone?: string
): CalendarClient {
  return {
    async getFreeBusy(request): Promise<FreeBusyResponse> {
      const startTime = Math.floor(request.timeMin.getTime() / 1000);
      const endTime = Math.floor(request.timeMax.getTime() / 1000);
      const data = await nylasGetFreeBusy(grantId, grantEmail, startTime, endTime);
      // Map Nylas free/busy to our format
      const busy: Array<{ start: Date; end: Date }> = [];
      if (Array.isArray(data)) {
        for (const entry of data) {
          const slots = (entry as unknown as Record<string, unknown>).timeSlots as Array<{ startTime: number; endTime: number; status: string }> | undefined;
          if (slots) {
            for (const slot of slots) {
              if (slot.status === "busy") {
                busy.push({
                  start: new Date(slot.startTime * 1000),
                  end: new Date(slot.endTime * 1000),
                });
              }
            }
          }
        }
      }
      return { busy, calendarId };
    },

    async createEvent(event: CreateEventInput): Promise<CalendarEvent> {
      const result = await nylasCreateEvent(grantId, calendarId, {
        title: event.summary,
        description: event.description,
        startTime: Math.floor(event.start.getTime() / 1000),
        endTime: Math.floor(event.end.getTime() / 1000),
        timezone: timezone || "UTC",
        attendees: event.attendees?.map(a => ({ email: a.email, name: a.name || "" })),
        location: event.location,
        conferencing: true,
      });
      return {
        id: result.id || "",
        summary: event.summary,
        start: event.start,
        end: event.end,
        status: "confirmed",
      };
    },

    async getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
      const events = await nylasGetEvents(
        grantId,
        calendarId,
        Math.floor(timeMin.getTime() / 1000),
        Math.floor(timeMax.getTime() / 1000)
      );
      return events.map((e) => {
        const ev = e as unknown as Record<string, unknown>;
        const when = ev.when as Record<string, number> | undefined;
        return {
          id: e.id || "",
          summary: (ev.title as string) || "",
          start: new Date((when?.startTime || 0) * 1000),
          end: new Date((when?.endTime || 0) * 1000),
          status: "confirmed" as const,
        };
      });
    },

    async deleteEvent(eventId: string): Promise<void> {
      await nylasDeleteEvent(grantId, calendarId, eventId);
    },

    async listCalendars(): Promise<CalendarInfo[]> {
      const cals = await nylasListCalendars(grantId);
      return cals.map((c) => ({
        id: c.id || "",
        summary: c.name || "",
        primary: (c as unknown as Record<string, unknown>).isPrimary === true,
        accessRole: "owner" as const,
      }));
    },

    async refreshTokensIfNeeded(): Promise<OAuthTokens | null> {
      // Nylas manages token refresh internally - no-op
      return null;
    },
  };
}

/**
 * Create a calendar client for a business
 * Uses Nylas grant for calendar operations
 */
export async function createCalendarClient(
  businessId: string
): Promise<CalendarClient | null> {
  const grant = await getNylasGrant(businessId);
  if (grant) {
    // Fetch business timezone for calendar events
    let timezone: string | undefined;
    try {
      const supabase = createAdminClient();
      const { data } = await (supabase as any)
        .from("businesses")
        .select("timezone")
        .eq("id", businessId)
        .single();
      timezone = data?.timezone || undefined;
    } catch {
      // Fall back to UTC
    }
    return createNylasCalendarAdapter(grant.grantId, grant.grantEmail, grant.calendarId, timezone);
  }

  // No Nylas grant connected
  return null;
}

// ============================================
// Token Storage Helpers
// ============================================

/**
 * Store OAuth tokens for a business
 */
export async function storeCalendarTokens(
  businessId: string,
  provider: CalendarProvider,
  tokens: OAuthTokens,
  calendarId?: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from("calendar_integrations")
    .upsert(
      {
        business_id: businessId,
        provider,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt.toISOString(),
        calendar_id: calendarId || "primary",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );

  if (error) {
    throw new CalendarAuthError(
      "Failed to save calendar connection",
      provider,
      false
    );
  }
}

/**
 * Disconnect a calendar integration (Nylas or legacy)
 */
export async function disconnectCalendar(
  businessId: string
): Promise<void> {
  // Check if using Nylas
  const grant = await getNylasGrant(businessId);
  if (grant) {
    await disconnectNylasGrant(businessId);
    return;
  }

  // Legacy disconnect
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from("calendar_integrations")
    .update({
      provider: "built_in",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      calendar_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (error) {
    throw new Error("Failed to disconnect calendar");
  }
}

/**
 * Check if a calendar is connected (Nylas or legacy)
 */
export async function isCalendarConnected(
  businessId: string
): Promise<{ connected: boolean; provider: CalendarProvider; email?: string }> {
  // Check Nylas first
  const grant = await getNylasGrant(businessId);
  if (grant) {
    const provider = (grant.grantProvider === "microsoft" ? "outlook" : grant.grantProvider) as CalendarProvider;
    return { connected: true, provider, email: grant.grantEmail };
  }

  // Legacy check
  const supabase = createAdminClient();

  const { data, error } = await (supabase as any)
    .from("calendar_integrations")
    .select("provider, access_token")
    .eq("business_id", businessId)
    .single();

  if (error || !data) {
    return { connected: false, provider: "built_in" };
  }

  const provider = data.provider as CalendarProvider;
  const connected = provider !== "built_in" && !!data.access_token;

  return { connected, provider };
}

// ============================================
// Availability Helpers
// ============================================

/**
 * Check if a time slot is available
 */
export async function isTimeSlotAvailable(
  businessId: string,
  start: Date,
  end: Date
): Promise<boolean> {
  const client = await createCalendarClient(businessId);

  if (!client) {
    // No external calendar - assume available
    // (should check built-in appointments instead)
    return true;
  }

  try {
    const { busy } = await client.getFreeBusy({
      timeMin: start,
      timeMax: end,
    });

    // Check if any busy period overlaps with requested slot
    for (const slot of busy) {
      if (slot.start < end && slot.end > start) {
        return false;
      }
    }

    return true;
  } catch {
    // On error, assume available to not block bookings
    return true;
  }
}

/**
 * Get events from the connected calendar for a date range
 * Returns events including their status (confirmed, tentative, cancelled)
 */
export async function getCalendarEvents(
  businessId: string,
  timeMin: Date,
  timeMax: Date
): Promise<{
  id: string;
  summary: string;
  start: Date;
  end: Date;
  status: string;
}[]> {
  const client = await createCalendarClient(businessId);

  if (!client) {
    return [];
  }

  try {
    const events = await client.getEvents(timeMin, timeMax);
    return events.map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start,
      end: e.end,
      status: e.status,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete an event from the connected calendar
 * Used when cancelling appointments to also remove from external calendar
 */
export async function deleteCalendarEvent(
  businessId: string,
  eventId: string
): Promise<boolean> {
  const client = await createCalendarClient(businessId);

  if (!client) {
    return false;
  }

  try {
    await client.deleteEvent(eventId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an appointment event in the connected calendar
 */
export async function createAppointmentEvent(
  businessId: string,
  appointmentDetails: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    customerEmail?: string;
    customerName?: string;
    location?: string;
  }
): Promise<string | null> {
  const client = await createCalendarClient(businessId);

  if (!client) {
    // No external calendar connected
    return null;
  }

  try {
    const event = await client.createEvent({
      summary: appointmentDetails.summary,
      description: appointmentDetails.description,
      start: appointmentDetails.start,
      end: appointmentDetails.end,
      location: appointmentDetails.location,
      attendees: appointmentDetails.customerEmail
        ? [
            {
              email: appointmentDetails.customerEmail,
              name: appointmentDetails.customerName,
            },
          ]
        : undefined,
    });

    return event.id;
  } catch {
    return null;
  }
}
