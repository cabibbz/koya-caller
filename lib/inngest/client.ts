/**
 * Koya Caller - Inngest Client Configuration
 * Session 21: Background Jobs
 * Spec Reference: Part 16, Lines 1918-1968
 */

import { Inngest } from "inngest";

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;

// Create the base Inngest client
const baseInngest = new Inngest({
  id: "koya-caller",
  name: "Koya Caller",
});

/**
 * Wrapped Inngest client that falls back to direct processing
 * when Inngest is not configured (no INNGEST_EVENT_KEY)
 */
export const inngest = {
  ...baseInngest,

  /**
   * Send an event - falls back to direct API call if Inngest not configured
   */
  async send(event: { name: string; data: Record<string, unknown> }): Promise<void> {
    // If Inngest is configured, use it normally
    if (INNGEST_EVENT_KEY) {
      try {
        await baseInngest.send(event);
        return;
      } catch (error) {
        console.error("[Inngest] Send failed, falling back to direct:", error);
      }
    }

    // Fallback: Handle prompt regeneration in background (fire-and-forget)
    if (event.name === "prompt/regeneration.requested") {
      const { businessId, triggeredBy } = event.data as { businessId: string; triggeredBy: string };
      console.log(`[Inngest Fallback] Queuing prompt regeneration for ${businessId} (${triggeredBy})`);

      // Always use localhost for internal API calls in development
      const isDev = process.env.NODE_ENV === "development";
      const baseUrl = isDev ? "http://localhost:3000" : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

      // Fire-and-forget: Don't await, let it run in background
      // This makes the save instant while regeneration happens async
      fetch(`${baseUrl}/api/claude/process-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-call": "true",
        },
        body: JSON.stringify({ businessId, triggeredBy }),
      })
        .then(async (response) => {
          if (!response.ok) {
            console.error(`[Inngest Fallback] Process queue returned ${response.status}`);
          } else {
            const result = await response.json();
            if (result.success) {
              console.log(`[Inngest Fallback] Prompt regeneration completed successfully`);
            } else {
              console.error(`[Inngest Fallback] Regeneration failed:`, result.errors);
            }
          }
        })
        .catch((error) => {
          console.error("[Inngest Fallback] Direct processing failed:", error);
        });

      // Return immediately - don't wait for regeneration
    } else {
      console.warn(`[Inngest] Event ${event.name} not processed - Inngest not configured`);
    }
  },

  // Expose the original for functions that need it
  _base: baseInngest,
};

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
