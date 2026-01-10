/**
 * Outlook Calendar Client (Microsoft Graph)
 * Session 20: Calendar OAuth & Sync
 * 
 * Handles:
 * - OAuth 2.0 flow with Azure AD
 * - Free/busy queries via Microsoft Graph
 * - Event creation for appointments
 */

import type {
  CalendarClient,
  CalendarEvent,
  CalendarInfo,
  CreateEventInput,
  FreeBusyRequest,
  FreeBusyResponse,
  OAuthTokens,
  TimeSlot,
} from "./types";
import { CalendarAuthError, CalendarApiError } from "./types";

// ============================================
// Configuration
// ============================================

const AZURE_AUTH_URL = "https://login.microsoftonline.com";
const GRAPH_API = "https://graph.microsoft.com/v1.0";

// Scopes needed for calendar access
const SCOPES = [
  "offline_access", // Required for refresh token
  "Calendars.ReadWrite",
  "User.Read",
].join(" ");

function getOutlookCredentials() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || "common"; // "common" for multi-tenant
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/outlook/callback`;

  if (!clientId || !clientSecret) {
    throw new CalendarAuthError(
      "Microsoft/Outlook credentials not configured",
      "outlook",
      false
    );
  }

  return { clientId, clientSecret, tenantId, redirectUri };
}

// ============================================
// OAuth Functions
// ============================================

/**
 * Generate the Microsoft OAuth authorization URL
 */
export function getOutlookAuthUrl(state: string): string {
  const { clientId, tenantId, redirectUri } = getOutlookCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    response_mode: "query",
    state,
  });

  return `${AZURE_AUTH_URL}/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeOutlookCode(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, tenantId, redirectUri } = getOutlookCredentials();

  const response = await fetch(
    `${AZURE_AUTH_URL}/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: SCOPES,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Outlook OAuth] Token exchange failed:", error);
    throw new CalendarAuthError(
      "Failed to exchange authorization code",
      "outlook",
      true
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshOutlookTokens(
  refreshToken: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret, tenantId } = getOutlookCredentials();

  const response = await fetch(
    `${AZURE_AUTH_URL}/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        scope: SCOPES,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Outlook OAuth] Token refresh failed:", error);
    throw new CalendarAuthError(
      "Failed to refresh access token. Please reconnect your calendar.",
      "outlook",
      true
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

// ============================================
// Outlook Calendar Client Class
// ============================================

export class OutlookCalendarClient implements CalendarClient {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;
  private calendarId: string;
  private onTokenRefresh?: (tokens: OAuthTokens) => Promise<void>;

  constructor(
    tokens: OAuthTokens,
    calendarId: string = "primary",
    onTokenRefresh?: (tokens: OAuthTokens) => Promise<void>
  ) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.expiresAt = tokens.expiresAt;
    this.calendarId = calendarId;
    this.onTokenRefresh = onTokenRefresh;
  }

  /**
   * Check if tokens need refresh and refresh them
   */
  async refreshTokensIfNeeded(): Promise<OAuthTokens | null> {
    // Refresh if token expires in less than 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (this.expiresAt.getTime() - Date.now() > bufferMs) {
      return null; // No refresh needed
    }

    console.log("[Outlook Calendar] Refreshing expired tokens");
    const newTokens = await refreshOutlookTokens(this.refreshToken);

    // Update internal state
    this.accessToken = newTokens.accessToken;
    this.refreshToken = newTokens.refreshToken;
    this.expiresAt = newTokens.expiresAt;

    // Notify caller to persist new tokens
    if (this.onTokenRefresh) {
      await this.onTokenRefresh(newTokens);
    }

    return newTokens;
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.refreshTokensIfNeeded();

    const url = `${GRAPH_API}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Outlook Calendar] API error (${response.status}):`, error);

      if (response.status === 401) {
        throw new CalendarAuthError(
          "Calendar authorization expired. Please reconnect.",
          "outlook",
          true
        );
      }

      throw new CalendarApiError(
        `Outlook Calendar API error: ${response.statusText}`,
        "outlook",
        response.status
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Get calendar endpoint based on calendarId
   */
  private getCalendarPath(): string {
    if (this.calendarId === "primary" || !this.calendarId) {
      return "/me/calendar";
    }
    return `/me/calendars/${this.calendarId}`;
  }

  /**
   * Get free/busy times for a date range
   */
  async getFreeBusy(request: FreeBusyRequest): Promise<FreeBusyResponse> {
    // Microsoft Graph uses getSchedule for free/busy
    const body = {
      schedules: ["me"],
      startTime: {
        dateTime: request.timeMin.toISOString(),
        timeZone: "UTC",
      },
      endTime: {
        dateTime: request.timeMax.toISOString(),
        timeZone: "UTC",
      },
      availabilityViewInterval: 30, // 30-minute slots
    };

    const data = await this.apiRequest<{
      value: {
        scheduleId: string;
        scheduleItems: {
          start: { dateTime: string };
          end: { dateTime: string };
          status: string;
        }[];
      }[];
    }>("/me/calendar/getSchedule", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const busy: TimeSlot[] = [];
    for (const schedule of data.value || []) {
      for (const item of schedule.scheduleItems || []) {
        if (item.status !== "free") {
          busy.push({
            start: new Date(item.start.dateTime),
            end: new Date(item.end.dateTime),
          });
        }
      }
    }

    return { busy, calendarId: this.calendarId };
  }

  /**
   * Create a calendar event
   */
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const body = {
      subject: input.summary,
      body: input.description
        ? {
            contentType: "text",
            content: input.description,
          }
        : undefined,
      location: input.location
        ? {
            displayName: input.location,
          }
        : undefined,
      start: {
        dateTime: input.start.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: input.end.toISOString(),
        timeZone: "UTC",
      },
      attendees: input.attendees?.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: "required",
      })),
    };

    const data = await this.apiRequest<{
      id: string;
      subject: string;
      body?: { content: string };
      start: { dateTime: string };
      end: { dateTime: string };
      location?: { displayName: string };
      showAs: string;
      attendees?: {
        emailAddress: { address: string; name?: string };
        status: { response: string };
      }[];
    }>(`${this.getCalendarPath()}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      summary: data.subject,
      description: data.body?.content,
      start: new Date(data.start.dateTime),
      end: new Date(data.end.dateTime),
      location: data.location?.displayName,
      status: this.mapOutlookStatus(data.showAs),
      attendees: data.attendees?.map((a) => ({
        email: a.emailAddress.address,
        name: a.emailAddress.name,
        responseStatus: this.mapOutlookResponse(a.status.response),
      })),
    };
  }

  /**
   * Get events in a date range
   */
  async getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const filter = `start/dateTime ge '${timeMin.toISOString()}' and end/dateTime le '${timeMax.toISOString()}'`;
    const params = new URLSearchParams({
      $filter: filter,
      $orderby: "start/dateTime",
      $top: "100",
    });

    const data = await this.apiRequest<{
      value: {
        id: string;
        subject: string;
        body?: { content: string };
        start: { dateTime: string };
        end: { dateTime: string };
        location?: { displayName: string };
        showAs: string;
      }[];
    }>(`${this.getCalendarPath()}/events?${params}`);

    return (data.value || []).map((item) => ({
      id: item.id,
      summary: item.subject || "(No title)",
      description: item.body?.content,
      start: new Date(item.start.dateTime),
      end: new Date(item.end.dateTime),
      location: item.location?.displayName,
      status: this.mapOutlookStatus(item.showAs),
    }));
  }

  /**
   * Delete/cancel an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.apiRequest(
      `${this.getCalendarPath()}/events/${eventId}`,
      { method: "DELETE" }
    );
  }

  /**
   * List available calendars
   */
  async listCalendars(): Promise<CalendarInfo[]> {
    const data = await this.apiRequest<{
      value: {
        id: string;
        name: string;
        isDefaultCalendar?: boolean;
        canEdit: boolean;
      }[];
    }>("/me/calendars");

    return (data.value || []).map((cal) => ({
      id: cal.id,
      summary: cal.name,
      primary: cal.isDefaultCalendar || false,
      accessRole: cal.canEdit ? "writer" : "reader",
    }));
  }

  /**
   * Map Outlook showAs to our status type
   */
  private mapOutlookStatus(showAs: string): "confirmed" | "tentative" | "cancelled" {
    switch (showAs) {
      case "tentative":
        return "tentative";
      case "free":
      case "unknown":
        return "cancelled";
      default:
        return "confirmed";
    }
  }

  /**
   * Map Outlook response status
   */
  private mapOutlookResponse(
    response: string
  ): "accepted" | "declined" | "tentative" | "needsAction" {
    switch (response) {
      case "accepted":
        return "accepted";
      case "declined":
        return "declined";
      case "tentativelyAccepted":
        return "tentative";
      default:
        return "needsAction";
    }
  }
}

/**
 * Create an Outlook Calendar client from stored credentials
 */
export function createOutlookClient(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  calendarId: string = "primary",
  onTokenRefresh?: (tokens: OAuthTokens) => Promise<void>
): OutlookCalendarClient {
  return new OutlookCalendarClient(
    { accessToken, refreshToken, expiresAt },
    calendarId,
    onTokenRefresh
  );
}
