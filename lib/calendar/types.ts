/**
 * Calendar Integration Types
 * Session 20: Calendar OAuth & Sync
 * 
 * Scope: Read availability + create events (Option B)
 */

// ============================================
// OAuth Types
// ============================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
}

export interface OAuthState {
  businessId: string;
  returnUrl: string;
  nonce: string;
}

// ============================================
// Calendar Provider Types
// ============================================

export type CalendarProvider = "google" | "outlook" | "built_in";

export interface CalendarCredentials {
  provider: CalendarProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  calendarId?: string;
}

// ============================================
// Calendar Event Types
// ============================================

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: CalendarAttendee[];
  status: "confirmed" | "tentative" | "cancelled";
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  responseStatus?: "accepted" | "declined" | "tentative" | "needsAction";
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: { email: string; name?: string }[];
}

// ============================================
// Availability Types
// ============================================

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface FreeBusyRequest {
  timeMin: Date;
  timeMax: Date;
  calendarId?: string;
}

export interface FreeBusyResponse {
  busy: TimeSlot[];
  calendarId: string;
}

// ============================================
// Calendar Client Interface
// ============================================

export interface CalendarClient {
  /**
   * Get busy times for a date range
   */
  getFreeBusy(request: FreeBusyRequest): Promise<FreeBusyResponse>;

  /**
   * Create a calendar event
   */
  createEvent(event: CreateEventInput): Promise<CalendarEvent>;

  /**
   * Get events in a date range
   */
  getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]>;

  /**
   * Delete/cancel an event
   */
  deleteEvent(eventId: string): Promise<void>;

  /**
   * Get list of calendars (for selection)
   */
  listCalendars(): Promise<CalendarInfo[]>;

  /**
   * Refresh tokens if expired
   */
  refreshTokensIfNeeded(): Promise<OAuthTokens | null>;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: "owner" | "writer" | "reader";
}

// ============================================
// Error Types
// ============================================

export class CalendarAuthError extends Error {
  constructor(
    message: string,
    public readonly provider: CalendarProvider,
    public readonly requiresReauth: boolean = false
  ) {
    super(message);
    this.name = "CalendarAuthError";
  }
}

export class CalendarApiError extends Error {
  constructor(
    message: string,
    public readonly provider: CalendarProvider,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "CalendarApiError";
  }
}
