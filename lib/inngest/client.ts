/**
 * Koya Caller - Inngest Client Configuration
 * Session 21: Background Jobs
 * Spec Reference: Part 16, Lines 1918-1968
 */

import { Inngest } from "inngest";

// Create the Inngest client
export const inngest = new Inngest({
  id: "koya-caller",
  name: "Koya Caller",
});

// =============================================================================
// Event Types
// =============================================================================

export type KoyaEvents = {
  // Prompt regeneration events
  "prompt/regeneration.requested": {
    data: {
      businessId: string;
      triggeredBy: string;
    };
  };
  "prompt/queue.process": {
    data: Record<string, never>;
  };

  // Calendar token refresh events
  "calendar/token.refresh": {
    data: {
      businessId: string;
      provider: "google" | "outlook";
    };
  };
  "calendar/tokens.check-expiring": {
    data: Record<string, never>;
  };

  // Usage alert events
  "usage/check-alerts": {
    data: Record<string, never>;
  };
  "usage/alert.send": {
    data: {
      businessId: string;
      percentUsed: number;
      minutesUsed: number;
      minutesIncluded: number;
    };
  };

  // Appointment reminder events
  "appointment/reminders.check": {
    data: Record<string, never>;
  };
  "appointment/reminder.send": {
    data: {
      appointmentId: string;
      businessId: string;
      customerPhone: string;
      customerName: string;
      scheduledAt: string;
      serviceName: string;
      reminderType: "1hr" | "24hr";
    };
  };

  // Call notification events
  "call/missed.alert": {
    data: {
      callId: string;
      businessId: string;
      callerPhone: string;
      callerName?: string;
      callTime: string;
    };
  };
  "call/followup.send": {
    data: {
      callId: string;
      businessId: string;
      callerPhone: string;
      outcome: string;
      serviceName?: string;
    };
  };

  // Weekly report events
  "report/weekly.send": {
    data: {
      businessId: string;
      businessName: string;
      ownerEmail: string;
      timezone: string;
      minutesUsed: number;
      minutesIncluded: number;
    };
  };

  // Blog publishing events
  "blog/post.publish": {
    data: {
      postId: string;
    };
  };
};
