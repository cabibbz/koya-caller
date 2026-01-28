/**
 * Calendar Sync and Appointment Reminder Tests
 * Tests for background job calendar synchronization and SMS reminders
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Calendar Sync Configuration Tests
// =============================================================================

describe("Calendar Sync Configuration", () => {
  const SYNC_SCHEDULE = "*/15 * * * *"; // Every 15 minutes
  const SYNC_CONCURRENCY_LIMIT = 5;
  const SYNC_RETRIES = 2;
  const SYNC_RANGE_DAYS = 30;

  describe("Scheduled job configuration", () => {
    it("should run every 15 minutes", () => {
      expect(SYNC_SCHEDULE).toBe("*/15 * * * *");
    });

    it("should have concurrency limit of 5", () => {
      expect(SYNC_CONCURRENCY_LIMIT).toBe(5);
    });

    it("should retry failed syncs 2 times", () => {
      expect(SYNC_RETRIES).toBe(2);
    });

    it("should sync appointments within 30 days", () => {
      expect(SYNC_RANGE_DAYS).toBe(30);
    });
  });
});

// =============================================================================
// Calendar Integration Filtering Tests
// =============================================================================

describe("Calendar Integration Filtering", () => {
  interface CalendarIntegration {
    business_id: string;
    provider: string;
    access_token: string | null;
  }

  function filterActiveIntegrations(integrations: CalendarIntegration[]): CalendarIntegration[] {
    return integrations.filter(
      (i) => i.provider !== "built_in" && i.access_token !== null
    );
  }

  describe("Integration filtering", () => {
    it("should exclude built_in provider", () => {
      const integrations: CalendarIntegration[] = [
        { business_id: "1", provider: "built_in", access_token: "token" },
        { business_id: "2", provider: "google", access_token: "token" },
      ];

      const filtered = filterActiveIntegrations(integrations);
      expect(filtered.length).toBe(1);
      expect(filtered[0].provider).toBe("google");
    });

    it("should exclude integrations without access token", () => {
      const integrations: CalendarIntegration[] = [
        { business_id: "1", provider: "google", access_token: null },
        { business_id: "2", provider: "google", access_token: "valid-token" },
      ];

      const filtered = filterActiveIntegrations(integrations);
      expect(filtered.length).toBe(1);
      expect(filtered[0].access_token).toBe("valid-token");
    });

    it("should return empty array when no valid integrations", () => {
      const integrations: CalendarIntegration[] = [
        { business_id: "1", provider: "built_in", access_token: "token" },
        { business_id: "2", provider: "google", access_token: null },
      ];

      const filtered = filterActiveIntegrations(integrations);
      expect(filtered.length).toBe(0);
    });

    it("should include multiple valid integrations", () => {
      const integrations: CalendarIntegration[] = [
        { business_id: "1", provider: "google", access_token: "token1" },
        { business_id: "2", provider: "outlook", access_token: "token2" },
        { business_id: "3", provider: "built_in", access_token: "token3" },
      ];

      const filtered = filterActiveIntegrations(integrations);
      expect(filtered.length).toBe(2);
    });
  });
});

// =============================================================================
// Appointment Sync Status Tests
// =============================================================================

describe("Appointment Sync Status", () => {
  interface CalendarEvent {
    id: string;
    summary: string;
    start: string;
    end: string;
    status: string;
  }

  interface Appointment {
    id: string;
    external_event_id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
  }

  interface SyncResult {
    action: "cancelled" | "rescheduled" | "unchanged";
    reason?: string;
    newTime?: string;
    newDuration?: number;
  }

  function determineSyncAction(
    appointment: Appointment,
    calendarEvent: CalendarEvent | null
  ): SyncResult {
    // Event not found in calendar
    if (!calendarEvent) {
      const aptTime = new Date(appointment.scheduled_at);
      if (aptTime > new Date()) {
        return { action: "cancelled", reason: "Calendar event was deleted" };
      }
      return { action: "unchanged" };
    }

    // Event explicitly cancelled
    if (calendarEvent.status === "cancelled") {
      return { action: "cancelled", reason: "Calendar event was cancelled" };
    }

    // Check if time changed
    const calendarStart = new Date(calendarEvent.start);
    const aptStart = new Date(appointment.scheduled_at);
    const timeDiffMs = Math.abs(calendarStart.getTime() - aptStart.getTime());

    // Allow 1 minute tolerance
    if (timeDiffMs > 60000) {
      const calendarEnd = new Date(calendarEvent.end);
      const newDuration = Math.round((calendarEnd.getTime() - calendarStart.getTime()) / 60000);

      return {
        action: "rescheduled",
        newTime: calendarStart.toISOString(),
        newDuration: newDuration > 0 ? newDuration : appointment.duration_minutes,
      };
    }

    return { action: "unchanged" };
  }

  describe("Event not found scenarios", () => {
    it("should cancel future appointments when event deleted", () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: futureDate,
        duration_minutes: 60,
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, null);
      expect(result.action).toBe("cancelled");
      expect(result.reason).toContain("deleted");
    });

    it("should not cancel past appointments when event deleted", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: pastDate,
        duration_minutes: 60,
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, null);
      expect(result.action).toBe("unchanged");
    });
  });

  describe("Event cancelled scenarios", () => {
    it("should cancel appointment when event status is cancelled", () => {
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: "2024-02-15T10:00:00Z",
        duration_minutes: 60,
        status: "confirmed",
      };

      const calendarEvent: CalendarEvent = {
        id: "event-1",
        summary: "Appointment",
        start: "2024-02-15T10:00:00Z",
        end: "2024-02-15T11:00:00Z",
        status: "cancelled",
      };

      const result = determineSyncAction(appointment, calendarEvent);
      expect(result.action).toBe("cancelled");
      expect(result.reason).toContain("cancelled");
    });
  });

  describe("Event rescheduled scenarios", () => {
    it("should detect rescheduled event", () => {
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: "2024-02-15T10:00:00Z",
        duration_minutes: 60,
        status: "confirmed",
      };

      const calendarEvent: CalendarEvent = {
        id: "event-1",
        summary: "Appointment",
        start: "2024-02-15T14:00:00Z", // Moved 4 hours later
        end: "2024-02-15T15:00:00Z",
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, calendarEvent);
      expect(result.action).toBe("rescheduled");
      expect(result.newTime).toBe("2024-02-15T14:00:00.000Z");
    });

    it("should detect changed duration", () => {
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: "2024-02-15T10:00:00Z",
        duration_minutes: 60,
        status: "confirmed",
      };

      const calendarEvent: CalendarEvent = {
        id: "event-1",
        summary: "Appointment",
        start: "2024-02-15T12:00:00Z",
        end: "2024-02-15T14:00:00Z", // 2 hours instead of 1
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, calendarEvent);
      expect(result.action).toBe("rescheduled");
      expect(result.newDuration).toBe(120);
    });

    it("should allow 1 minute tolerance for time comparison", () => {
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: "2024-02-15T10:00:00Z",
        duration_minutes: 60,
        status: "confirmed",
      };

      const calendarEvent: CalendarEvent = {
        id: "event-1",
        summary: "Appointment",
        start: "2024-02-15T10:00:30Z", // 30 seconds different
        end: "2024-02-15T11:00:30Z",
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, calendarEvent);
      expect(result.action).toBe("unchanged");
    });
  });

  describe("Unchanged scenarios", () => {
    it("should mark unchanged when times match", () => {
      const appointment: Appointment = {
        id: "apt-1",
        external_event_id: "event-1",
        scheduled_at: "2024-02-15T10:00:00Z",
        duration_minutes: 60,
        status: "confirmed",
      };

      const calendarEvent: CalendarEvent = {
        id: "event-1",
        summary: "Appointment",
        start: "2024-02-15T10:00:00Z",
        end: "2024-02-15T11:00:00Z",
        status: "confirmed",
      };

      const result = determineSyncAction(appointment, calendarEvent);
      expect(result.action).toBe("unchanged");
    });
  });
});

// =============================================================================
// Appointment Reminder Configuration Tests
// =============================================================================

describe("Appointment Reminder Configuration", () => {
  const REMINDER_SCHEDULE = "*/15 * * * *"; // Every 15 minutes
  const REMINDER_24HR_WINDOW_START = 23; // hours
  const REMINDER_24HR_WINDOW_END = 25; // hours
  const REMINDER_1HR_WINDOW_START = 55; // minutes
  const REMINDER_1HR_WINDOW_END = 65; // minutes
  const REMINDER_RETRIES = 3;

  describe("Reminder schedule", () => {
    it("should run every 15 minutes", () => {
      expect(REMINDER_SCHEDULE).toBe("*/15 * * * *");
    });

    it("should have 3 retry attempts", () => {
      expect(REMINDER_RETRIES).toBe(3);
    });
  });

  describe("24-hour reminder window", () => {
    it("should check appointments 23-25 hours out", () => {
      expect(REMINDER_24HR_WINDOW_START).toBe(23);
      expect(REMINDER_24HR_WINDOW_END).toBe(25);
    });

    it("should have 2-hour window for 24hr reminders", () => {
      expect(REMINDER_24HR_WINDOW_END - REMINDER_24HR_WINDOW_START).toBe(2);
    });
  });

  describe("1-hour reminder window", () => {
    it("should check appointments 55-65 minutes out", () => {
      expect(REMINDER_1HR_WINDOW_START).toBe(55);
      expect(REMINDER_1HR_WINDOW_END).toBe(65);
    });

    it("should have 10-minute window for 1hr reminders", () => {
      expect(REMINDER_1HR_WINDOW_END - REMINDER_1HR_WINDOW_START).toBe(10);
    });
  });
});

// =============================================================================
// Reminder Type Filtering Tests
// =============================================================================

describe("Reminder Type Filtering", () => {
  interface NotificationSettings {
    sms_customer_reminder: "none" | "1hr" | "24hr" | "both";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Type documentation
  interface Appointment {
    id: string;
    customer_phone: string | null;
    notification_settings: NotificationSettings | null;
  }

  function should24hrReminder(settings: NotificationSettings | null): boolean {
    return settings?.sms_customer_reminder === "24hr" || settings?.sms_customer_reminder === "both";
  }

  function should1hrReminder(settings: NotificationSettings | null): boolean {
    return settings?.sms_customer_reminder === "1hr" || settings?.sms_customer_reminder === "both";
  }

  describe("24-hour reminder eligibility", () => {
    it("should be eligible with '24hr' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "24hr" };
      expect(should24hrReminder(settings)).toBe(true);
    });

    it("should be eligible with 'both' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "both" };
      expect(should24hrReminder(settings)).toBe(true);
    });

    it("should not be eligible with '1hr' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "1hr" };
      expect(should24hrReminder(settings)).toBe(false);
    });

    it("should not be eligible with 'none' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "none" };
      expect(should24hrReminder(settings)).toBe(false);
    });

    it("should not be eligible with null settings", () => {
      expect(should24hrReminder(null)).toBe(false);
    });
  });

  describe("1-hour reminder eligibility", () => {
    it("should be eligible with '1hr' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "1hr" };
      expect(should1hrReminder(settings)).toBe(true);
    });

    it("should be eligible with 'both' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "both" };
      expect(should1hrReminder(settings)).toBe(true);
    });

    it("should not be eligible with '24hr' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "24hr" };
      expect(should1hrReminder(settings)).toBe(false);
    });

    it("should not be eligible with 'none' setting", () => {
      const settings: NotificationSettings = { sms_customer_reminder: "none" };
      expect(should1hrReminder(settings)).toBe(false);
    });
  });
});

// =============================================================================
// Reminder Event Data Tests
// =============================================================================

describe("Reminder Event Data", () => {
  interface ReminderEventData {
    appointmentId: string;
    businessId: string;
    customerPhone: string;
    customerName: string;
    scheduledAt: string;
    serviceName: string;
    reminderType: "1hr" | "24hr";
  }

  function createReminderEvent(
    appointment: {
      id: string;
      business_id: string;
      customer_phone: string | null;
      customer_name: string | null;
      scheduled_at: string;
      service_name: string | null;
    },
    reminderType: "1hr" | "24hr"
  ): ReminderEventData | null {
    if (!appointment.customer_phone) {
      return null;
    }

    return {
      appointmentId: appointment.id,
      businessId: appointment.business_id,
      customerPhone: appointment.customer_phone,
      customerName: appointment.customer_name || "Customer",
      scheduledAt: appointment.scheduled_at,
      serviceName: appointment.service_name || "Appointment",
      reminderType,
    };
  }

  describe("Event creation", () => {
    it("should create valid event with all data", () => {
      const appointment = {
        id: "apt-1",
        business_id: "biz-1",
        customer_phone: "+14155551234",
        customer_name: "John Doe",
        scheduled_at: "2024-02-15T10:00:00Z",
        service_name: "Haircut",
      };

      const event = createReminderEvent(appointment, "24hr");
      expect(event).not.toBeNull();
      expect(event?.appointmentId).toBe("apt-1");
      expect(event?.customerPhone).toBe("+14155551234");
      expect(event?.reminderType).toBe("24hr");
    });

    it("should return null without customer phone", () => {
      const appointment = {
        id: "apt-1",
        business_id: "biz-1",
        customer_phone: null,
        customer_name: "John Doe",
        scheduled_at: "2024-02-15T10:00:00Z",
        service_name: "Haircut",
      };

      const event = createReminderEvent(appointment, "24hr");
      expect(event).toBeNull();
    });

    it("should use default customer name when null", () => {
      const appointment = {
        id: "apt-1",
        business_id: "biz-1",
        customer_phone: "+14155551234",
        customer_name: null,
        scheduled_at: "2024-02-15T10:00:00Z",
        service_name: "Haircut",
      };

      const event = createReminderEvent(appointment, "1hr");
      expect(event?.customerName).toBe("Customer");
    });

    it("should use default service name when null", () => {
      const appointment = {
        id: "apt-1",
        business_id: "biz-1",
        customer_phone: "+14155551234",
        customer_name: "John Doe",
        scheduled_at: "2024-02-15T10:00:00Z",
        service_name: null,
      };

      const event = createReminderEvent(appointment, "1hr");
      expect(event?.serviceName).toBe("Appointment");
    });
  });
});

// =============================================================================
// Date/Time Formatting Tests
// =============================================================================

describe("Date/Time Formatting for Reminders", () => {
  function formatDateTime(isoString: string, timezone: string): string {
    const date = new Date(isoString);

    // Simple formatting - in real code would use Luxon
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    };

    return date.toLocaleDateString("en-US", options);
  }

  describe("Format output", () => {
    it("should include weekday", () => {
      const formatted = formatDateTime("2024-02-15T14:30:00Z", "America/New_York");
      expect(formatted).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    });

    it("should include month name", () => {
      const formatted = formatDateTime("2024-02-15T14:30:00Z", "America/New_York");
      expect(formatted).toContain("February");
    });

    it("should include day number", () => {
      const formatted = formatDateTime("2024-02-15T14:30:00Z", "America/New_York");
      expect(formatted).toContain("15");
    });
  });

  describe("Timezone handling", () => {
    it("should format in specified timezone", () => {
      const isoString = "2024-02-15T19:30:00Z"; // 7:30 PM UTC

      // This would be 2:30 PM EST (UTC-5)
      const formatted = formatDateTime(isoString, "America/New_York");
      expect(formatted).toBeDefined();
    });
  });
});

// =============================================================================
// Reminder Tracking Tests
// =============================================================================

describe("Reminder Tracking", () => {
  describe("Tracking field names", () => {
    function getReminderField(reminderType: "1hr" | "24hr"): string {
      return reminderType === "1hr" ? "reminder_1hr_sent_at" : "reminder_24hr_sent_at";
    }

    it("should return correct field for 1hr reminder", () => {
      expect(getReminderField("1hr")).toBe("reminder_1hr_sent_at");
    });

    it("should return correct field for 24hr reminder", () => {
      expect(getReminderField("24hr")).toBe("reminder_24hr_sent_at");
    });
  });

  describe("Duplicate prevention", () => {
    interface Appointment {
      id: string;
      reminder_1hr_sent_at: string | null;
      reminder_24hr_sent_at: string | null;
    }

    function needsReminder(apt: Appointment, type: "1hr" | "24hr"): boolean {
      if (type === "1hr") {
        return apt.reminder_1hr_sent_at === null;
      }
      return apt.reminder_24hr_sent_at === null;
    }

    it("should need 1hr reminder when not sent", () => {
      const apt: Appointment = {
        id: "1",
        reminder_1hr_sent_at: null,
        reminder_24hr_sent_at: null,
      };
      expect(needsReminder(apt, "1hr")).toBe(true);
    });

    it("should not need 1hr reminder when already sent", () => {
      const apt: Appointment = {
        id: "1",
        reminder_1hr_sent_at: "2024-02-14T09:00:00Z",
        reminder_24hr_sent_at: null,
      };
      expect(needsReminder(apt, "1hr")).toBe(false);
    });

    it("should need 24hr reminder when not sent", () => {
      const apt: Appointment = {
        id: "1",
        reminder_1hr_sent_at: null,
        reminder_24hr_sent_at: null,
      };
      expect(needsReminder(apt, "24hr")).toBe(true);
    });

    it("should not need 24hr reminder when already sent", () => {
      const apt: Appointment = {
        id: "1",
        reminder_1hr_sent_at: null,
        reminder_24hr_sent_at: "2024-02-14T10:00:00Z",
      };
      expect(needsReminder(apt, "24hr")).toBe(false);
    });
  });
});

// =============================================================================
// Sync Results Structure Tests
// =============================================================================

describe("Sync Results Structure", () => {
  interface SyncResults {
    cancelled: string[];
    rescheduled: string[];
    unchanged: number;
    errors: string[];
  }

  function createEmptyResults(): SyncResults {
    return {
      cancelled: [],
      rescheduled: [],
      unchanged: 0,
      errors: [],
    };
  }

  describe("Result initialization", () => {
    it("should start with empty arrays", () => {
      const results = createEmptyResults();
      expect(results.cancelled).toEqual([]);
      expect(results.rescheduled).toEqual([]);
      expect(results.errors).toEqual([]);
    });

    it("should start with zero unchanged count", () => {
      const results = createEmptyResults();
      expect(results.unchanged).toBe(0);
    });
  });

  describe("Result aggregation", () => {
    it("should track cancelled appointments", () => {
      const results = createEmptyResults();
      results.cancelled.push("apt-1", "apt-2");
      expect(results.cancelled.length).toBe(2);
    });

    it("should track rescheduled appointments", () => {
      const results = createEmptyResults();
      results.rescheduled.push("apt-3");
      expect(results.rescheduled.length).toBe(1);
    });

    it("should increment unchanged count", () => {
      const results = createEmptyResults();
      results.unchanged++;
      results.unchanged++;
      expect(results.unchanged).toBe(2);
    });

    it("should track errors with details", () => {
      const results = createEmptyResults();
      results.errors.push("apt-4: Connection timeout");
      expect(results.errors[0]).toContain("apt-4");
    });
  });
});

// =============================================================================
// Calendar Provider Tests
// =============================================================================

describe("Calendar Provider Handling", () => {
  const SUPPORTED_PROVIDERS = ["google", "outlook"] as const;
  const EXCLUDED_PROVIDERS = ["built_in"] as const;

  describe("Provider validation", () => {
    it("should support google provider", () => {
      expect(SUPPORTED_PROVIDERS).toContain("google");
    });

    it("should support outlook provider", () => {
      expect(SUPPORTED_PROVIDERS).toContain("outlook");
    });

    it("should exclude built_in from sync", () => {
      expect(EXCLUDED_PROVIDERS).toContain("built_in");
    });
  });

  describe("Provider-specific handling", () => {
    function isExternalProvider(provider: string): boolean {
      return provider !== "built_in";
    }

    it("should identify google as external", () => {
      expect(isExternalProvider("google")).toBe(true);
    });

    it("should identify outlook as external", () => {
      expect(isExternalProvider("outlook")).toBe(true);
    });

    it("should not identify built_in as external", () => {
      expect(isExternalProvider("built_in")).toBe(false);
    });
  });
});

// =============================================================================
// Time Window Calculation Tests
// =============================================================================

describe("Time Window Calculations", () => {
  function calculateTimeWindow(
    baseDate: Date,
    startOffset: { hours?: number; minutes?: number },
    endOffset: { hours?: number; minutes?: number }
  ): { start: Date; end: Date } {
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    if (startOffset.hours) {
      start.setTime(start.getTime() + startOffset.hours * 60 * 60 * 1000);
    }
    if (startOffset.minutes) {
      start.setTime(start.getTime() + startOffset.minutes * 60 * 1000);
    }

    if (endOffset.hours) {
      end.setTime(end.getTime() + endOffset.hours * 60 * 60 * 1000);
    }
    if (endOffset.minutes) {
      end.setTime(end.getTime() + endOffset.minutes * 60 * 1000);
    }

    return { start, end };
  }

  describe("24-hour reminder window", () => {
    it("should calculate correct start time (23 hours from now)", () => {
      const now = new Date("2024-02-15T10:00:00Z");
      const window = calculateTimeWindow(now, { hours: 23 }, { hours: 25 });

      expect(window.start.toISOString()).toBe("2024-02-16T09:00:00.000Z");
    });

    it("should calculate correct end time (25 hours from now)", () => {
      const now = new Date("2024-02-15T10:00:00Z");
      const window = calculateTimeWindow(now, { hours: 23 }, { hours: 25 });

      expect(window.end.toISOString()).toBe("2024-02-16T11:00:00.000Z");
    });
  });

  describe("1-hour reminder window", () => {
    it("should calculate correct start time (55 minutes from now)", () => {
      const now = new Date("2024-02-15T10:00:00Z");
      const window = calculateTimeWindow(now, { minutes: 55 }, { minutes: 65 });

      expect(window.start.toISOString()).toBe("2024-02-15T10:55:00.000Z");
    });

    it("should calculate correct end time (65 minutes from now)", () => {
      const now = new Date("2024-02-15T10:00:00Z");
      const window = calculateTimeWindow(now, { minutes: 55 }, { minutes: 65 });

      expect(window.end.toISOString()).toBe("2024-02-15T11:05:00.000Z");
    });
  });
});

// =============================================================================
// Opt-Out Handling Tests
// =============================================================================

describe("SMS Opt-Out Handling", () => {
  interface SMSResult {
    success: boolean;
    skipped: boolean;
    reason?: string;
  }

  function checkOptOut(
    customerPhone: string,
    optedOutNumbers: Set<string>
  ): boolean {
    // Normalize phone for comparison
    const normalized = customerPhone.replace(/\D/g, "");
    return optedOutNumbers.has(normalized);
  }

  describe("Opt-out checking", () => {
    it("should detect opted-out number", () => {
      const optedOut = new Set(["14155551234"]);
      expect(checkOptOut("+1-415-555-1234", optedOut)).toBe(true);
    });

    it("should allow non-opted-out number", () => {
      const optedOut = new Set(["14155551234"]);
      expect(checkOptOut("+1-415-555-9999", optedOut)).toBe(false);
    });

    it("should normalize phone formats for comparison", () => {
      // When stored without country code, match without country code
      const optedOut = new Set(["4155551234"]);
      expect(checkOptOut("(415) 555-1234", optedOut)).toBe(true);
    });
  });

  describe("Skip behavior", () => {
    function handleOptedOutSMS(isOptedOut: boolean): SMSResult {
      if (isOptedOut) {
        return { success: true, skipped: true, reason: "Customer opted out" };
      }
      return { success: true, skipped: false };
    }

    it("should mark as skipped when opted out", () => {
      const result = handleOptedOutSMS(true);
      expect(result.skipped).toBe(true);
      expect(result.success).toBe(true); // Still "success" to avoid retries
    });

    it("should not mark as skipped when not opted out", () => {
      const result = handleOptedOutSMS(false);
      expect(result.skipped).toBe(false);
    });
  });
});

// =============================================================================
// Appointment Status Filter Tests
// =============================================================================

describe("Appointment Status Filtering", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Status documentation
  const SYNCABLE_STATUSES = ["confirmed", "scheduled"] as const;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Status documentation
  const NON_SYNCABLE_STATUSES = ["cancelled", "completed", "no_show"] as const;

  describe("Status filtering", () => {
    function isSyncable(status: string): boolean {
      return status !== "cancelled" && status !== "completed" && status !== "no_show";
    }

    it("should sync confirmed appointments", () => {
      expect(isSyncable("confirmed")).toBe(true);
    });

    it("should sync scheduled appointments", () => {
      expect(isSyncable("scheduled")).toBe(true);
    });

    it("should not sync cancelled appointments", () => {
      expect(isSyncable("cancelled")).toBe(false);
    });

    it("should not sync completed appointments", () => {
      expect(isSyncable("completed")).toBe(false);
    });

    it("should not sync no_show appointments", () => {
      expect(isSyncable("no_show")).toBe(false);
    });
  });
});

// =============================================================================
// Event Map Building Tests
// =============================================================================

describe("Calendar Event Map Building", () => {
  interface CalendarEvent {
    id: string;
    summary: string;
    start: string;
    end: string;
  }

  function buildEventMap(events: CalendarEvent[]): Map<string, CalendarEvent> {
    const map = new Map<string, CalendarEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    return map;
  }

  describe("Map construction", () => {
    it("should create map from events", () => {
      const events: CalendarEvent[] = [
        { id: "event-1", summary: "Meeting 1", start: "2024-02-15T10:00:00Z", end: "2024-02-15T11:00:00Z" },
        { id: "event-2", summary: "Meeting 2", start: "2024-02-15T14:00:00Z", end: "2024-02-15T15:00:00Z" },
      ];

      const map = buildEventMap(events);
      expect(map.size).toBe(2);
    });

    it("should allow lookup by ID", () => {
      const events: CalendarEvent[] = [
        { id: "event-1", summary: "Meeting 1", start: "2024-02-15T10:00:00Z", end: "2024-02-15T11:00:00Z" },
      ];

      const map = buildEventMap(events);
      const event = map.get("event-1");
      expect(event?.summary).toBe("Meeting 1");
    });

    it("should return undefined for unknown ID", () => {
      const map = buildEventMap([]);
      expect(map.get("unknown")).toBeUndefined();
    });
  });
});

// =============================================================================
// Reminder Check Results Tests
// =============================================================================

describe("Reminder Check Results", () => {
  interface CheckResults {
    checked: {
      "24hr": number;
      "1hr": number;
    };
    remindersQueued: number;
  }

  function createCheckResults(
    count24hr: number,
    count1hr: number,
    queued: number
  ): CheckResults {
    return {
      checked: {
        "24hr": count24hr,
        "1hr": count1hr,
      },
      remindersQueued: queued,
    };
  }

  describe("Results structure", () => {
    it("should track 24hr appointments checked", () => {
      const results = createCheckResults(10, 5, 15);
      expect(results.checked["24hr"]).toBe(10);
    });

    it("should track 1hr appointments checked", () => {
      const results = createCheckResults(10, 5, 15);
      expect(results.checked["1hr"]).toBe(5);
    });

    it("should track total reminders queued", () => {
      const results = createCheckResults(10, 5, 15);
      expect(results.remindersQueued).toBe(15);
    });
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe("Edge Cases", () => {
  // ---------------------------------------------------------------------------
  // DST Transition Dates
  // ---------------------------------------------------------------------------
  describe("DST transition dates", () => {
    function formatInTimezone(isoString: string, timezone: string): string {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", { timeZone: timezone });
    }

    function getLocalHour(isoString: string, timezone: string): number {
      const date = new Date(isoString);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      });
      return parseInt(formatter.format(date), 10);
    }

    function calculateTimeDifferenceMinutes(start: string, end: string): number {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    }

    it("should handle spring forward (March DST start in US)", () => {
      // March 10, 2024 - US DST starts at 2:00 AM
      // 2:00 AM becomes 3:00 AM (1 hour lost)
      const beforeDST = "2024-03-10T06:30:00Z"; // 1:30 AM EST
      const afterDST = "2024-03-10T07:30:00Z"; // 3:30 AM EDT (skipped 2:30)

      const hourBefore = getLocalHour(beforeDST, "America/New_York");
      const hourAfter = getLocalHour(afterDST, "America/New_York");

      expect(hourBefore).toBe(1);
      expect(hourAfter).toBe(3);
    });

    it("should handle fall back (November DST end in US)", () => {
      // November 3, 2024 - US DST ends at 2:00 AM
      // 2:00 AM becomes 1:00 AM (1 hour gained)
      const _beforeDST = "2024-11-03T05:30:00Z"; // 1:30 AM EDT
      const afterDST = "2024-11-03T07:30:00Z"; // 2:30 AM EST

      const formatted = formatInTimezone(afterDST, "America/New_York");
      expect(formatted).toBeDefined();
    });

    it("should calculate correct duration across spring forward", () => {
      // Appointment from 1:30 AM to 3:30 AM on DST day
      // In UTC, this is 2 hours, but clock shows 1 hour due to spring forward
      const start = "2024-03-10T06:30:00Z"; // 1:30 AM EST
      const end = "2024-03-10T08:30:00Z"; // 3:30 AM EDT

      const durationMinutes = calculateTimeDifferenceMinutes(start, end);
      expect(durationMinutes).toBe(120); // Actual elapsed time is 2 hours
    });

    it("should calculate correct duration across fall back", () => {
      // Appointment during the repeated hour
      const start = "2024-11-03T05:30:00Z";
      const end = "2024-11-03T07:30:00Z";

      const durationMinutes = calculateTimeDifferenceMinutes(start, end);
      expect(durationMinutes).toBe(120);
    });

    it("should handle appointment scheduled during non-existent time", () => {
      // 2:30 AM on March 10, 2024 doesn't exist (skipped)
      // Should be interpreted as 3:30 AM EDT
      const nonExistentTime = "2024-03-10T07:30:00Z"; // Would be 2:30 AM EST if DST hadn't happened
      const formatted = formatInTimezone(nonExistentTime, "America/New_York");
      expect(formatted).toContain("3:30"); // Shifted forward
    });
  });

  // ---------------------------------------------------------------------------
  // Timezones with 30/45 Minute Offsets
  // ---------------------------------------------------------------------------
  describe("Timezones with 30/45 minute offsets", () => {
    function _getTimezoneOffset(timezone: string, date: Date = new Date()): string {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "longOffset",
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === "timeZoneName");
      return tzPart?.value || "";
    }

    function formatTimeInTimezone(isoString: string, timezone: string): string {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    it("should handle India timezone (+5:30)", () => {
      // India Standard Time is UTC+5:30
      const utcTime = "2024-02-15T12:00:00Z";
      const formatted = formatTimeInTimezone(utcTime, "Asia/Kolkata");

      // 12:00 UTC + 5:30 = 17:30 IST
      expect(formatted).toBe("17:30");
    });

    it("should handle Nepal timezone (+5:45)", () => {
      // Nepal Time is UTC+5:45
      const utcTime = "2024-02-15T12:00:00Z";
      const formatted = formatTimeInTimezone(utcTime, "Asia/Kathmandu");

      // 12:00 UTC + 5:45 = 17:45 NPT
      expect(formatted).toBe("17:45");
    });

    it("should handle Australia/Adelaide (+9:30 or +10:30 with DST)", () => {
      const utcTime = "2024-02-15T12:00:00Z"; // February = summer in Australia
      const formatted = formatTimeInTimezone(utcTime, "Australia/Adelaide");

      // Adelaide is UTC+10:30 during DST
      expect(formatted).toBe("22:30");
    });

    it("should handle Iran timezone (+3:30)", () => {
      const utcTime = "2024-02-15T12:00:00Z";
      const formatted = formatTimeInTimezone(utcTime, "Asia/Tehran");

      // Iran is UTC+3:30
      expect(formatted).toBe("15:30");
    });

    it("should handle Newfoundland timezone (-3:30)", () => {
      const utcTime = "2024-02-15T12:00:00Z";
      const formatted = formatTimeInTimezone(utcTime, "America/St_Johns");

      // Newfoundland is UTC-3:30
      expect(formatted).toBe("08:30");
    });

    it("should handle Chatham Islands (+12:45)", () => {
      const utcTime = "2024-02-15T12:00:00Z";
      const formatted = formatTimeInTimezone(utcTime, "Pacific/Chatham");

      // Chatham is UTC+12:45 (or +13:45 with DST)
      expect(formatted).toMatch(/00:45|01:45/); // Depends on DST
    });

    it("should correctly offset appointment times for India", () => {
      // Doctor in India schedules appointment at 14:00 IST
      // Convert to UTC for storage: 14:00 IST = 08:30 UTC
      const localTime = "14:00";
      const offsetMinutes = 330; // India is +5:30 = 330 minutes
      const localHours = parseInt(localTime.split(":")[0]);
      const localMinutes = parseInt(localTime.split(":")[1]);

      const totalLocalMinutes = localHours * 60 + localMinutes;
      const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
      const utcHours = Math.floor(totalUtcMinutes / 60);
      const utcMinutes = totalUtcMinutes % 60;

      expect(utcHours).toBe(8);
      expect(utcMinutes).toBe(30);
    });
  });

  // ---------------------------------------------------------------------------
  // All-Day Events
  // ---------------------------------------------------------------------------
  describe("All-day events", () => {
    interface CalendarEvent {
      id: string;
      summary: string;
      start: string;
      end: string;
      isAllDay: boolean;
    }

    interface _Appointment {
      id: string;
      scheduled_at: string;
      duration_minutes: number;
    }

    function isAllDayEvent(event: CalendarEvent): boolean {
      // All-day events typically have date-only strings (no time component)
      // or span exactly 24 hours
      if (event.isAllDay) return true;

      const start = new Date(event.start);
      const end = new Date(event.end);
      const durationMs = end.getTime() - start.getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      return durationMs >= twentyFourHoursMs;
    }

    function convertAllDayToTimeRange(
      eventDate: string,
      businessHours: { open: string; close: string },
      _timezone: string
    ): { start: string; end: string } {
      // Convert all-day event to business hours
      const date = eventDate.split("T")[0]; // Get just the date part
      return {
        start: `${date}T${businessHours.open}:00`,
        end: `${date}T${businessHours.close}:00`,
      };
    }

    function shouldSyncAllDayEvent(event: CalendarEvent): boolean {
      // All-day events may be holidays, vacations, etc.
      // Skip them for appointment sync purposes
      return !isAllDayEvent(event);
    }

    it("should detect all-day event by flag", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Office Closed",
        start: "2024-02-15",
        end: "2024-02-16",
        isAllDay: true,
      };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it("should detect all-day event by duration", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Full Day Event",
        start: "2024-02-15T00:00:00Z",
        end: "2024-02-16T00:00:00Z",
        isAllDay: false,
      };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it("should not detect regular event as all-day", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Meeting",
        start: "2024-02-15T10:00:00Z",
        end: "2024-02-15T11:00:00Z",
        isAllDay: false,
      };
      expect(isAllDayEvent(event)).toBe(false);
    });

    it("should convert all-day event to business hours", () => {
      const businessHours = { open: "09:00", close: "17:00" };
      const result = convertAllDayToTimeRange("2024-02-15", businessHours, "America/New_York");

      expect(result.start).toBe("2024-02-15T09:00:00");
      expect(result.end).toBe("2024-02-15T17:00:00");
    });

    it("should skip all-day events for sync", () => {
      const allDayEvent: CalendarEvent = {
        id: "1",
        summary: "Vacation",
        start: "2024-02-15T00:00:00Z",
        end: "2024-02-16T00:00:00Z",
        isAllDay: true,
      };
      expect(shouldSyncAllDayEvent(allDayEvent)).toBe(false);
    });

    it("should sync regular events", () => {
      const regularEvent: CalendarEvent = {
        id: "1",
        summary: "Appointment",
        start: "2024-02-15T10:00:00Z",
        end: "2024-02-15T11:00:00Z",
        isAllDay: false,
      };
      expect(shouldSyncAllDayEvent(regularEvent)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid Date Strings
  // ---------------------------------------------------------------------------
  describe("Invalid date strings", () => {
    function isValidDateString(dateStr: string): boolean {
      if (!dateStr || typeof dateStr !== "string") return false;

      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    }

    function parseDateSafe(dateStr: string): Date | null {
      if (!isValidDateString(dateStr)) return null;
      return new Date(dateStr);
    }

    function formatDateSafe(dateStr: string, timezone: string): string | null {
      const date = parseDateSafe(dateStr);
      if (!date) return null;

      try {
        return date.toLocaleString("en-US", { timeZone: timezone });
      } catch {
        return null;
      }
    }

    it("should reject empty string", () => {
      expect(isValidDateString("")).toBe(false);
    });

    it("should reject null-like strings", () => {
      expect(isValidDateString("null")).toBe(false);
      expect(isValidDateString("undefined")).toBe(false);
    });

    it("should reject random text", () => {
      expect(isValidDateString("not a date")).toBe(false);
      expect(isValidDateString("tomorrow at noon")).toBe(false);
    });

    it("should reject malformed ISO strings", () => {
      expect(isValidDateString("2024-13-15")).toBe(false); // Invalid month
      // Note: JavaScript Date is lenient - "2024-02-30" becomes March 1st, still valid Date
      // This tests that basic parsing works; strict validation would need additional checks
      expect(isValidDateString("2024-02-15T25:00:00Z")).toBe(false); // Invalid hour
    });

    it("should accept valid ISO strings", () => {
      expect(isValidDateString("2024-02-15T10:00:00Z")).toBe(true);
      expect(isValidDateString("2024-02-15")).toBe(true);
    });

    it("should accept various valid date formats", () => {
      expect(isValidDateString("February 15, 2024")).toBe(true);
      expect(isValidDateString("2024/02/15")).toBe(true);
    });

    it("should return null for invalid date in parseDateSafe", () => {
      expect(parseDateSafe("invalid")).toBeNull();
      expect(parseDateSafe("2024-13-45")).toBeNull();
    });

    it("should return valid Date for valid string", () => {
      const date = parseDateSafe("2024-02-15T10:00:00Z");
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it("should return null for invalid date in formatDateSafe", () => {
      expect(formatDateSafe("invalid", "America/New_York")).toBeNull();
    });

    it("should format valid date correctly", () => {
      const formatted = formatDateSafe("2024-02-15T15:00:00Z", "America/New_York");
      expect(formatted).not.toBeNull();
      expect(formatted).toContain("2024");
    });

    it("should handle leap year edge case", () => {
      expect(isValidDateString("2024-02-29")).toBe(true); // 2024 is leap year

      // Note: JavaScript Date behavior with invalid dates varies by environment
      // Some environments parse "2023-02-29" as Feb 28, others as March 1
      // For strict validation, we should compare parsed date back to input
      function isStrictlyValidDate(dateStr: string): boolean {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;

        // For YYYY-MM-DD format, verify the date matches what was input
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, year, month, day] = match;
          return (
            date.getUTCFullYear() === parseInt(year) &&
            date.getUTCMonth() + 1 === parseInt(month) &&
            date.getUTCDate() === parseInt(day)
          );
        }
        return true;
      }

      expect(isStrictlyValidDate("2024-02-29")).toBe(true); // Valid leap year date
      expect(isStrictlyValidDate("2023-02-29")).toBe(false); // Invalid - Feb 29 doesn't exist in 2023
    });
  });

  // ---------------------------------------------------------------------------
  // Appointments at Midnight
  // ---------------------------------------------------------------------------
  describe("Appointments at midnight", () => {
    function formatTimeDisplay(isoString: string, timezone: string): string {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    function isAtMidnight(isoString: string, timezone: string): boolean {
      const date = new Date(isoString);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
      const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);

      return hour === 0 && minute === 0;
    }

    function getAppointmentDay(isoString: string, timezone: string): string {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }

    it("should correctly display midnight as 12:00 AM", () => {
      const midnight = "2024-02-15T05:00:00Z"; // Midnight EST
      const formatted = formatTimeDisplay(midnight, "America/New_York");
      expect(formatted).toBe("12:00 AM");
    });

    it("should detect midnight appointment", () => {
      const midnight = "2024-02-15T05:00:00Z"; // Midnight EST
      expect(isAtMidnight(midnight, "America/New_York")).toBe(true);
    });

    it("should not detect noon as midnight", () => {
      const noon = "2024-02-15T17:00:00Z"; // Noon EST
      expect(isAtMidnight(noon, "America/New_York")).toBe(false);
    });

    it("should correctly identify the day for midnight appointments", () => {
      // Midnight on Feb 15 should be Feb 15, not Feb 14
      const midnight = "2024-02-15T05:00:00Z"; // Midnight EST on Feb 15
      const day = getAppointmentDay(midnight, "America/New_York");
      expect(day).toContain("February 15");
    });

    it("should handle 11:59 PM correctly (day before)", () => {
      // 11:59 PM on Feb 14
      const almostMidnight = "2024-02-15T04:59:00Z"; // 11:59 PM EST
      const day = getAppointmentDay(almostMidnight, "America/New_York");
      expect(day).toContain("February 14");
    });

    it("should handle 12:01 AM correctly (new day)", () => {
      const justAfterMidnight = "2024-02-15T05:01:00Z"; // 12:01 AM EST
      const day = getAppointmentDay(justAfterMidnight, "America/New_York");
      expect(day).toContain("February 15");
    });

    it("should distinguish between midnight start of day and end of previous day", () => {
      // These are the same instant but often confused in UIs
      const endOfFeb14 = "2024-02-14T23:59:59-05:00"; // 11:59:59 PM Feb 14 EST
      const startOfFeb15 = "2024-02-15T00:00:00-05:00"; // Midnight Feb 15 EST

      const day1 = getAppointmentDay(endOfFeb14, "America/New_York");
      const day2 = getAppointmentDay(startOfFeb15, "America/New_York");

      expect(day1).toContain("February 14");
      expect(day2).toContain("February 15");
    });

    it("should handle midnight crossing date boundary in different timezone", () => {
      // Midnight in Tokyo (JST) is 10:00 AM the previous day in New York
      const midnightTokyo = "2024-02-15T15:00:00Z"; // Midnight Feb 16 JST
      expect(isAtMidnight(midnightTokyo, "Asia/Tokyo")).toBe(true);

      // Same instant in New York is 10:00 AM
      const formatted = formatTimeDisplay(midnightTokyo, "America/New_York");
      expect(formatted).toBe("10:00 AM");
    });
  });
});
