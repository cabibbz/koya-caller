/**
 * Google Calendar Client
 * Session 20: Calendar OAuth & Sync
 * 
 * Handles:
 * - OAuth 2.0 flow (authorization URL, token exchange, refresh)
 * - Free/busy queries
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

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Scopes needed for our use case (read availability + create events)
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/google/callback`;

  if (!clientId || !clientSecret) {
    throw new CalendarAuthError(
      "Google Calendar credentials not configured",
      "google",
      false
    );
  }

  return { clientId, clientSecret, redirectUri };
}

// ============================================
// OAuth Functions
// ============================================

/**
 * Generate the Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // Required for refresh token
    prompt: "consent", // Force consent to get refresh token
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
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
    }),
  });

  if (!response.ok) {
    throw new CalendarAuthError(
      "Failed to exchange authorization code",
      "google",
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
export async function refreshGoogleTokens(
  refreshToken: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new CalendarAuthError(
      "Failed to refresh access token. Please reconnect your calendar.",
      "google",
      true
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    // Google may not return a new refresh token
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

// ============================================
// Google Calendar Client Class
// ============================================

export class GoogleCalendarClient implements CalendarClient {
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

    const newTokens = await refreshGoogleTokens(this.refreshToken);

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

    const url = `${GOOGLE_CALENDAR_API}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new CalendarAuthError(
          "Calendar authorization expired. Please reconnect.",
          "google",
          true
        );
      }

      throw new CalendarApiError(
        `Google Calendar API error: ${response.statusText}`,
        "google",
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get free/busy times for a date range
   */
  async getFreeBusy(request: FreeBusyRequest): Promise<FreeBusyResponse> {
    const calendarId = request.calendarId || this.calendarId;

    const body = {
      timeMin: request.timeMin.toISOString(),
      timeMax: request.timeMax.toISOString(),
      items: [{ id: calendarId }],
    };

    const data = await this.apiRequest<{
      calendars: Record<string, { busy: { start: string; end: string }[] }>;
    }>("/freeBusy", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const calendar = data.calendars[calendarId];
    const busy: TimeSlot[] = (calendar?.busy || []).map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));

    return { busy, calendarId };
  }

  /**
   * Create a calendar event
   */
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.start.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: input.end.toISOString(),
        timeZone: "UTC",
      },
      attendees: input.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name,
      })),
    };

    const data = await this.apiRequest<{
      id: string;
      summary: string;
      description?: string;
      start: { dateTime: string };
      end: { dateTime: string };
      location?: string;
      status: string;
      attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    }>(`/calendars/${encodeURIComponent(this.calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      start: new Date(data.start.dateTime),
      end: new Date(data.end.dateTime),
      location: data.location,
      status: data.status as "confirmed" | "tentative" | "cancelled",
      attendees: data.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus as "accepted" | "declined" | "tentative" | "needsAction",
      })),
    };
  }

  /**
   * Get events in a date range
   */
  async getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const data = await this.apiRequest<{
      items: {
        id: string;
        summary: string;
        description?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
        status: string;
      }[];
    }>(`/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`);

    return (data.items || []).map((item) => ({
      id: item.id,
      summary: item.summary || "(No title)",
      description: item.description,
      start: new Date(item.start.dateTime || item.start.date || ""),
      end: new Date(item.end.dateTime || item.end.date || ""),
      location: item.location,
      status: item.status as "confirmed" | "tentative" | "cancelled",
    }));
  }

  /**
   * Delete/cancel an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.apiRequest(
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  }

  /**
   * List available calendars
   */
  async listCalendars(): Promise<CalendarInfo[]> {
    const data = await this.apiRequest<{
      items: {
        id: string;
        summary: string;
        primary?: boolean;
        accessRole: string;
      }[];
    }>("/users/me/calendarList");

    return (data.items || []).map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      accessRole: cal.accessRole as "owner" | "writer" | "reader",
    }));
  }
}

/**
 * Create a Google Calendar client from stored credentials
 */
export function createGoogleClient(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  calendarId: string = "primary",
  onTokenRefresh?: (tokens: OAuthTokens) => Promise<void>
): GoogleCalendarClient {
  return new GoogleCalendarClient(
    { accessToken, refreshToken, expiresAt },
    calendarId,
    onTokenRefresh
  );
}
