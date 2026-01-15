/**
 * Calendar Integration Module
 * Session 20: Calendar OAuth & Sync
 * 
 * Unified interface for calendar operations across providers.
 * Supports: Google Calendar, Outlook/Microsoft Graph, Built-in
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarClient, CalendarProvider, OAuthTokens } from "./types";
import { CalendarAuthError } from "./types";
import { createGoogleClient } from "./google";
import { createOutlookClient } from "./outlook";

// Re-export everything
export * from "./types";
export * from "./google";
export * from "./outlook";

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
 * Create a calendar client for a business
 * Automatically handles token refresh and persistence
 */
export async function createCalendarClient(
  businessId: string
): Promise<CalendarClient | null> {
  const supabase = createAdminClient();

  // Fetch calendar integration
  const { data: integration, error } = await (supabase as any)
    .from("calendar_integrations")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error || !integration) {
    return null;
  }

  const provider = integration.provider as CalendarProvider;

  // Built-in calendar doesn't need external client
  if (provider === "built_in") {
    return null;
  }

  // Validate tokens exist
  if (!integration.access_token || !integration.refresh_token) {
    return null;
  }

  // Token refresh callback - persists new tokens to database
  const onTokenRefresh = async (tokens: OAuthTokens) => {
    const { error: updateError } = await (supabase as any)
      .from("calendar_integrations")
      .update({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    if (updateError) {
      // Error handled silently
    }
  };

  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at)
    : new Date(0); // Force refresh if no expiry set

  const calendarId = integration.calendar_id || "primary";

  if (provider === "google") {
    return createGoogleClient(
      integration.access_token,
      integration.refresh_token,
      expiresAt,
      calendarId,
      onTokenRefresh
    );
  }

  if (provider === "outlook") {
    return createOutlookClient(
      integration.access_token,
      integration.refresh_token,
      expiresAt,
      calendarId,
      onTokenRefresh
    );
  }

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
 * Disconnect a calendar integration
 */
export async function disconnectCalendar(
  businessId: string
): Promise<void> {
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
 * Check if a calendar is connected
 */
export async function isCalendarConnected(
  businessId: string
): Promise<{ connected: boolean; provider: CalendarProvider }> {
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
